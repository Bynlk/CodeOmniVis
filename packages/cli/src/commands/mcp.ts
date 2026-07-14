/**
 * mcp 命令
 *
 * 启动 MCP Server。
 * npx codeomnivis mcp → 启动 MCP Server
 */

import type { Command } from 'commander'
import * as path from 'path'

interface McpOptions {
  project: string
}

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP Server for AI assistant integration')
    .option('--project <path>', 'Project root path', '.')
    .action(async (options: McpOptions) => {
      let handle: { close: () => Promise<void> } | undefined
      let stopRequested = false
      let stopping = false
      const stop = (): void => {
        stopRequested = true
        if (!handle || stopping) return
        stopping = true
        void handle.close()
          .then(() => process.exit(0))
          .catch((err: unknown) => {
            process.stderr.write(`Failed to stop MCP Server: ${String(err)}\n`)
            process.exit(1)
          })
      }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)

      try {
        const projectRoot = path.resolve(options.project)
        const { startMcpServer } = await import('@codeomnivis/mcp')
        handle = await startMcpServer({ projectRoot })
        if (stopRequested) stop()
      } catch (err) {
        process.removeListener('SIGINT', stop)
        process.removeListener('SIGTERM', stop)
        process.stderr.write(`Failed to start MCP Server: ${String(err)}\n`)
        process.exitCode = 1
      }
    })
}
