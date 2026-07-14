import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const START_TIMEOUT_MS = 45_000
const STOP_TIMEOUT_MS = 5_000
const MAX_LOG_CHARS = 32_000

export interface WorkbenchServer {
  url: string
  stop: () => Promise<void>
  logs: () => string
}

async function reservePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to reserve a TCP port')
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
  return address.port
}

function appendLog(current: string, chunk: Buffer): string {
  return (current + chunk.toString('utf8')).slice(-MAX_LOG_CHARS)
}

async function waitForGraph(url: string, child: ChildProcessWithoutNullStreams, logs: () => string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Workbench server exited before ready\n${logs()}`)
    }
    try {
      const response = await fetch(`${url}/api/graph`)
      if (response.ok) {
        const payload: unknown = await response.json()
        if (
          payload && typeof payload === 'object' && 'data' in payload
          && payload.data && typeof payload.data === 'object' && 'nodes' in payload.data
          && Array.isArray(payload.data.nodes) && payload.data.nodes.length > 0
        ) return
      }
    } catch {
      // The child is still starting; the bounded deadline below remains authoritative.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
  }
  throw new Error(`Workbench server did not become ready within ${START_TIMEOUT_MS}ms\n${logs()}`)
}

async function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise<void>(resolveExit => child.once('exit', () => resolveExit()))
  child.kill('SIGTERM')
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = await Promise.race([
    exited.then(() => {
      if (timeout) clearTimeout(timeout)
      return false
    }),
    new Promise<boolean>(resolveTimeout => {
      timeout = setTimeout(() => resolveTimeout(true), STOP_TIMEOUT_MS)
    }),
  ])
  if (timedOut && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exited
  }
}

export async function startWorkbenchServer(): Promise<WorkbenchServer> {
  const port = await reservePort()
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [
    resolve(REPO_ROOT, 'packages/cli/bin/codeomnivis.js'),
    'serve',
    '--project', resolve(REPO_ROOT, 'demo'),
    '--host', '127.0.0.1',
    '--port', String(port),
    '--no-open',
  ], {
    cwd: REPO_ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout = appendLog(stdout, chunk) })
  child.stderr.on('data', chunk => { stderr = appendLog(stderr, chunk) })
  const logs = () => `${stdout}\n${stderr}`.trim()

  try {
    await waitForGraph(url, child, logs)
  } catch (error) {
    await stopChild(child)
    throw error
  }

  return { url, logs, stop: () => stopChild(child) }
}
