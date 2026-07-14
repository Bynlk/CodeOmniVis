import { describe, expect, it, vi } from 'vitest'
import { runMcpCommand } from '../../src/commands/mcp'

describe('runMcpCommand', () => {
  it('starts once and closes cleanly on SIGTERM', async () => {
    const listeners = new Map<string, () => void>()
    const close = vi.fn(async () => {})
    const exit = vi.fn()
    const start = vi.fn(async () => ({ close }))

    await runMcpCommand({ project: '.' }, {
      start,
      once: (signal, listener) => { listeners.set(signal, listener) },
      remove: vi.fn(),
      stderr: vi.fn(),
      exit,
      setExitCode: vi.fn(),
    })
    listeners.get('SIGTERM')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    expect(close).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(process.cwd())
  })

  it('removes listeners and reports a controlled startup failure', async () => {
    const remove = vi.fn()
    const stderr = vi.fn()
    const setExitCode = vi.fn()
    await runMcpCommand({ project: '.' }, {
      start: async () => { throw new Error('boom') },
      once: vi.fn(),
      remove,
      stderr,
      exit: vi.fn(),
      setExitCode,
    })
    expect(remove).toHaveBeenCalledTimes(2)
    expect(stderr.mock.calls.flat().join('')).toContain('Failed to start MCP Server')
    expect(setExitCode).toHaveBeenCalledWith(1)
  })

  it('reports shutdown failures without retrying the same handle', async () => {
    const listeners = new Map<string, () => void>()
    const exit = vi.fn()
    const stderr = vi.fn()
    await runMcpCommand({ project: '.' }, {
      start: async () => ({ close: async () => { throw new Error('close failed') } }),
      once: (signal, listener) => { listeners.set(signal, listener) },
      remove: vi.fn(),
      stderr,
      exit,
      setExitCode: vi.fn(),
    })
    listeners.get('SIGINT')?.()
    listeners.get('SIGINT')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
    expect(stderr.mock.calls.flat().join('')).toContain('Failed to stop MCP Server')
  })
})
