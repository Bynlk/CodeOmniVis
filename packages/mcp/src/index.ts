import { pathToFileURL } from 'node:url'
import { startMcpServer, type McpStdioHandle } from './stdio'

export * from './server'
export * from './stdio'
export * from './tools'

function isMainModule(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(entry).href
  } catch {
    return false
  }
}

if (isMainModule()) {
  let handle: McpStdioHandle | undefined
  let stopRequested = false
  let stopping = false

  const stop = (): void => {
    stopRequested = true
    if (!handle || stopping) return
    stopping = true
    void handle.close()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        process.stderr.write(`[codeomnivis-mcp] Shutdown failed: ${String(err)}\n`)
        process.exit(1)
      })
  }

  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  startMcpServer({ projectRoot: process.env.CODEOMNIVIS_PROJECT ?? process.cwd() })
    .then(started => {
      handle = started
      if (stopRequested) stop()
    })
    .catch((err: unknown) => {
      process.stderr.write(`[codeomnivis-mcp] Fatal: ${String(err)}\n`)
      process.exit(1)
    })
}
