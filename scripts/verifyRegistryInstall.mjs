import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { waitForPublishedVersion } from './registryVisibility.mjs'

const OFFICIAL_REGISTRY = 'https://registry.npmjs.org'
const PACKAGE_NAME = '@bynlk/codeomnivis'
const START_TIMEOUT_MS = 60_000
const STOP_TIMEOUT_MS = 5_000
const MAX_LOG_CHARS = 32_000

function commandEnvironment(tempRoot) {
  return {
    ...process.env,
    NO_COLOR: '1',
    npm_config_cache: resolve(tempRoot, '.npm-cache'),
    npm_config_registry: OFFICIAL_REGISTRY,
  }
}

function run(command, args, cwd, env) {
  try {
    return execFileSync(command, args, {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : ''
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : ''
    throw new Error(
      [
        'Command failed: ' + command + ' ' + args.join(' '),
        stdout && 'stdout:\n' + stdout,
        stderr && 'stderr:\n' + stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to allocate a loopback port'))
        return
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)))
    })
  })
}

async function createDemo(tempRoot) {
  const projectRoot = resolve(tempRoot, 'demo')
  await mkdir(resolve(projectRoot, 'app'), { recursive: true })
  await writeFile(
    resolve(projectRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'codeomnivis-registry-smoke-demo',
        private: true,
        dependencies: { next: '^15.0.0', react: '^18.3.0' },
      },
      null,
      2,
    ),
  )
  await writeFile(
    resolve(projectRoot, 'app/page.tsx'),
    'export default function RegistrySmokePage() {\n  return <main>registry smoke</main>\n}\n',
  )
  return projectRoot
}

function appendLog(current, chunk) {
  return (current + chunk.toString('utf8')).slice(-MAX_LOG_CHARS)
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Registry CLI exited before ready.\n' + logs())
    }
    try {
      const [health, graph, ui] = await Promise.all([
        fetch(url + '/api/health'),
        fetch(url + '/api/graph'),
        fetch(url + '/'),
      ])
      if (health.ok && graph.ok && ui.ok) {
        const graphPayload = await graph.json()
        const html = await ui.text()
        const nodeCount = graphPayload?.data?.nodes?.length ?? 0
        if (nodeCount > 0 && html.includes('<div id="root"></div>')) return
      }
    } catch {
      // Initial package download and analysis are bounded by the deadline above.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error(
    'Registry CLI did not expose health, a non-empty graph, and UI within ' +
      START_TIMEOUT_MS +
      'ms.\n' +
      logs(),
  )
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit))
  child.kill('SIGTERM')
  let timer
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((resolveTimeout) => {
      timer = setTimeout(() => resolveTimeout(true), STOP_TIMEOUT_MS)
    }),
  ])
  if (timer) clearTimeout(timer)
  if (timedOut && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exited
  }
}

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error('Usage: node scripts/verifyRegistryInstall.mjs <published-version>')
}

let tempRoot
let serverProcess
try {
  tempRoot = await mkdtemp(resolve(tmpdir(), 'codeomnivis-registry-'))
  const env = commandEnvironment(tempRoot)
  await writeFile(
    resolve(tempRoot, 'package.json'),
    JSON.stringify(
      { name: 'codeomnivis-registry-verifier', version: '1.0.0', private: true },
      null,
      2,
    ),
  )

  const packageSpec = PACKAGE_NAME + '@' + version
  const published = await waitForPublishedVersion({
    version,
    lookup: () =>
      run(
        'npm',
        ['view', packageSpec, 'version', '--registry=' + OFFICIAL_REGISTRY],
        tempRoot,
        env,
      ),
  })
  if (published !== version) {
    throw new Error('Official registry returned version "' + published + '" for ' + packageSpec)
  }

  const help = run(
    'npx',
    ['--yes', '--package', packageSpec, 'codeomnivis', '--help'],
    tempRoot,
    env,
  )
  if (!help.includes('Full-stack architecture visualizer for TypeScript projects')) {
    throw new Error('Registry CLI help did not contain the expected product description')
  }
  if (!help.includes('test-run') || !help.includes('mcp')) {
    throw new Error('Registry CLI help did not expose the current public commands')
  }

  const projectRoot = await createDemo(tempRoot)
  const port = await availablePort()
  const url = 'http://127.0.0.1:' + port
  let stdout = ''
  let stderr = ''
  serverProcess = spawn(
    'npx',
    [
      '--yes',
      '--package',
      packageSpec,
      'codeomnivis',
      'serve',
      '--project',
      projectRoot,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--no-open',
    ],
    { cwd: tempRoot, env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  serverProcess.stdout.on('data', (chunk) => {
    stdout = appendLog(stdout, chunk)
  })
  serverProcess.stderr.on('data', (chunk) => {
    stderr = appendLog(stderr, chunk)
  })
  await waitForServer(url, serverProcess, () => (stdout + '\n' + stderr).trim())
  console.log('Official registry verification passed for ' + packageSpec)
} finally {
  if (serverProcess) await stopChild(serverProcess)
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
}
