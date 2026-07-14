import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
}))

vi.mock('../src/server', () => ({
  createMcpServer: () => ({
    server: { connect: state.connect },
    close: state.close,
  }),
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class StdioServerTransport {},
}))

import { logToStderr, startMcpServer } from '../src/stdio'

beforeEach(() => {
  state.connect.mockReset()
  state.close.mockReset()
})

describe('MCP stdio startup', () => {
  it('connects the transport and returns the runtime close handle', async () => {
    const log = vi.fn()
    state.connect.mockResolvedValue(undefined)
    const handle = await startMcpServer({ projectRoot: '/project', log })
    expect(state.connect).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('MCP Server running on stdio')
    await handle.close()
    expect(state.close).toHaveBeenCalledOnce()
  })

  it('closes the runtime when transport connection fails', async () => {
    state.connect.mockRejectedValue(new Error('transport failed'))
    state.close.mockRejectedValue(new Error('close also failed'))
    await expect(startMcpServer({ projectRoot: '/project', log: vi.fn() }))
      .rejects.toThrow('transport failed')
    expect(state.close).toHaveBeenCalledOnce()
  })

  it('writes diagnostics to stderr with the protocol-safe prefix', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    logToStderr('ready')
    expect(write).toHaveBeenCalledWith('[codeomnivis-mcp] ready\n')
    write.mockRestore()
  })
})
