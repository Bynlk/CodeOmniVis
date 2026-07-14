import { pathToFileURL } from 'node:url'
import { startMcpServer, type McpStdioHandle } from './stdio'

export * from './server'
export * from './stdio'
export * from './tools'
export * from './tools/getTestCoverage'

export function isMainModule(entry: string | undefined, moduleUrl: string): boolean {
  return entry !== undefined && moduleUrl === pathToFileURL(entry).href
}

interface McpProcessRuntime {
  env: NodeJS.ProcessEnv
  cwd: () => string
  once: (event: 'SIGINT' | 'SIGTERM', listener: () => void) => unknown
  exit: (code: number) => unknown
  stderr: { write: (message: string) => unknown }
}

type McpStarter = (options: { projectRoot: string }) => Promise<McpStdioHandle>

export function runMcpProcess(
  runtime: McpProcessRuntime = process,
  start: McpStarter = startMcpServer,
): void {
  let handle: McpStdioHandle | undefined
  let stopRequested = false
  let stopping = false

  const stop = (): void => {
    stopRequested = true
    if (!handle || stopping) return
    stopping = true
    void handle.close()
      .then(() => runtime.exit(0))
      .catch((err: unknown) => {
        runtime.stderr.write(`[codeomnivis-mcp] Shutdown failed: ${String(err)}\n`)
        runtime.exit(1)
      })
  }

  runtime.once('SIGINT', stop)
  runtime.once('SIGTERM', stop)

  void start({ projectRoot: runtime.env.CODEOMNIVIS_PROJECT ?? runtime.cwd() })
    .then(started => {
      handle = started
      if (stopRequested) stop()
    })
    .catch((err: unknown) => {
      runtime.stderr.write(`[codeomnivis-mcp] Fatal: ${String(err)}\n`)
      runtime.exit(1)
    })
}

if (isMainModule(process.argv[1], import.meta.url)) runMcpProcess()
