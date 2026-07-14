/**
 * mcp 命令
 *
 * 启动 MCP Server。
 * npx codeomnivis mcp → 启动 MCP Server
 */

import type { Command } from 'commander'
import * as path from 'path'

export interface McpOptions {
  project: string
}

interface McpHandle {
  close: () => Promise<void>
}

export interface McpCommandDeps {
  start: (projectRoot: string) => Promise<McpHandle>
  once: (signal: 'SIGINT' | 'SIGTERM', listener: () => void) => void
  remove: (signal: 'SIGINT' | 'SIGTERM', listener: () => void) => void
  stderr: (message: string) => void
  exit: (code: number) => void
  setExitCode: (code: number) => void
}

const defaultDeps: McpCommandDeps = {
  start: async (projectRoot) => {
    const { startMcpServer } = await import('@codeomnivis/mcp')
    return startMcpServer({ projectRoot })
  },
  once: (signal, listener) => {
    process.once(signal, listener)
  },
  remove: (signal, listener) => {
    process.removeListener(signal, listener)
  },
  stderr: (message) => {
    process.stderr.write(message)
  },
  exit: (code) => {
    process.exit(code)
  },
  setExitCode: (code) => {
    process.exitCode = code
  },
}

export async function runMcpCommand(
  options: McpOptions,
  deps: McpCommandDeps = defaultDeps,
): Promise<void> {
  let handle: McpHandle | undefined
  let stopRequested = false
  let stopping = false
  const stop = (): void => {
    stopRequested = true
    if (!handle || stopping) return
    stopping = true
    void handle
      .close()
      .then(() => deps.exit(0))
      .catch((err: unknown) => {
        deps.stderr(`Failed to stop MCP Server: ${String(err)}\n`)
        deps.exit(1)
      })
  }
  deps.once('SIGINT', stop)
  deps.once('SIGTERM', stop)

  try {
    handle = await deps.start(path.resolve(options.project))
    if (stopRequested) stop()
  } catch (err) {
    deps.remove('SIGINT', stop)
    deps.remove('SIGTERM', stop)
    deps.stderr(`Failed to start MCP Server: ${String(err)}\n`)
    deps.setExitCode(1)
  }
}

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP Server for AI assistant integration')
    .option('--project <path>', 'Project root path', '.')
    .action(async (options: McpOptions) => {
      await runMcpCommand(options)
    })
}
