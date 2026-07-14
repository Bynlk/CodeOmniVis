import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OFFICIAL_REGISTRY = 'https://registry.npmjs.org'
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliRoot = resolve(repoRoot, 'packages/cli')

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : ''
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : ''
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        stdout && `stdout:\n${stdout}`,
        stderr && `stderr:\n${stderr}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

async function getAvailablePort() {
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

async function waitForPackedServer(port, child, output) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Packed CLI exited before becoming ready.\n${output()}`)
    }
    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/health`)
      const graph = await fetch(`http://127.0.0.1:${port}/api/graph`)
      const ui = await fetch(`http://127.0.0.1:${port}/`)
      if (health.ok && graph.ok && ui.ok) {
        const graphPayload = await graph.json()
        const nodeCount = graphPayload?.data?.nodes?.length ?? 0
        const html = await ui.text()
        if (nodeCount > 0 && html.includes('<div id="root"></div>')) return
      }
    } catch {
      // The server can refuse connections while its initial analysis is still running.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error(`Packed CLI did not become ready within 60 seconds.\n${output()}`)
}

async function stopChild(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

let tempRoot
let tarballPath
let serverProcess

try {
  await Promise.all([
    rm(resolve(cliRoot, 'dist'), { recursive: true, force: true }),
    rm(resolve(repoRoot, 'packages/ui/dist'), { recursive: true, force: true }),
    rm(resolve(repoRoot, 'packages/analyzer/dist'), { recursive: true, force: true }),
  ])
  run('pnpm', ['exec', 'turbo', 'build', '--force'], repoRoot)

  const packOutput = run('npm', ['pack', '--json', `--registry=${OFFICIAL_REGISTRY}`], cliRoot)
  const [packResult] = JSON.parse(packOutput)
  if (!packResult?.filename) throw new Error('npm pack did not report a tarball filename')
  const sourceMaps = (packResult.files ?? [])
    .map((file) => file.path)
    .filter((filePath) => filePath.endsWith('.map'))
  if (sourceMaps.length > 0) {
    throw new Error(`Packed CLI must not publish source maps:\n${sourceMaps.join('\n')}`)
  }
  tarballPath = resolve(cliRoot, packResult.filename)

  tempRoot = await mkdtemp(resolve(tmpdir(), 'codeomnivis-packed-cli-'))
  await writeFile(
    resolve(tempRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'codeomnivis-packed-cli-verifier',
        version: '1.0.0',
        private: true,
      },
      null,
      2,
    ),
  )

  run(
    'npm',
    ['install', '--no-audit', '--no-fund', `--registry=${OFFICIAL_REGISTRY}`, tarballPath],
    tempRoot,
  )

  const help = run('npx', ['--no-install', 'codeomnivis', '--help'], tempRoot)
  if (!help.includes('Full-stack architecture visualizer for TypeScript projects')) {
    throw new Error('Packed CLI help output did not contain the expected product description')
  }

  const installedManifest = JSON.parse(
    await readFile(resolve(tempRoot, 'node_modules/@bynlk/codeomnivis/package.json'), 'utf8'),
  )
  if (installedManifest.name !== '@bynlk/codeomnivis') {
    throw new Error(`Installed unexpected package: ${installedManifest.name}`)
  }

  const port = await getAvailablePort()
  const binPath = resolve(tempRoot, 'node_modules/.bin/codeomnivis')
  const outputChunks = []
  serverProcess = spawn(
    binPath,
    [
      'serve',
      '--project',
      resolve(repoRoot, 'demo'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--no-open',
    ],
    {
      cwd: tempRoot,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  serverProcess.stdout.on('data', (chunk) => outputChunks.push(chunk.toString()))
  serverProcess.stderr.on('data', (chunk) => outputChunks.push(chunk.toString()))

  await waitForPackedServer(port, serverProcess, () => outputChunks.join(''))
  console.log('Packed CLI verification passed')
} finally {
  if (serverProcess) await stopChild(serverProcess)
  if (tarballPath) await rm(tarballPath, { force: true })
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
}
