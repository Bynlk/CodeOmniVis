import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, describe, expect, it } from 'vitest'
import { PUBLIC_TOOL_NAMES } from '../src/server'

const repoRoot = new URL('../../..', import.meta.url).pathname
const cliBin = resolve(repoRoot, 'packages/cli/bin/codeomnivis.js')
const demoRoot = resolve(repoRoot, 'demo')

describe('MCP stdio protocol', () => {
  let client: Client | undefined
  let transport: StdioClientTransport | undefined

  afterEach(async () => {
    await client?.close().catch(() => {})
    await transport?.close().catch(() => {})
  })

  it('keeps the CLI process alive through initialization and tools/list', async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliBin, 'mcp', '--project', demoRoot],
      cwd: repoRoot,
      stderr: 'pipe',
    })
    client = new Client({ name: 'codeomnivis-e2e', version: '1.0.0' })

    await client.connect(transport)
    const result = await client.listTools()

    expect(transport.pid).not.toBeNull()
    expect(result.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([...PUBLIC_TOOL_NAMES]),
    )
  }, 30_000)
})
