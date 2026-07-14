import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './server'

export interface McpStdioOptions {
  projectRoot: string
  log?: (message: string) => void
}

export interface McpStdioHandle {
  close: () => Promise<void>
}

export function logToStderr(message: string): void {
  process.stderr.write(`[codeomnivis-mcp] ${message}\n`)
}

export async function startMcpServer(options: McpStdioOptions): Promise<McpStdioHandle> {
  const log = options.log ?? logToStderr
  const runtime = createMcpServer({ projectRoot: options.projectRoot, log })
  const transport = new StdioServerTransport()
  try {
    await runtime.server.connect(transport)
    log('MCP Server running on stdio')
    return { close: runtime.close }
  } catch (err) {
    await runtime.close().catch(() => {})
    throw err
  }
}
