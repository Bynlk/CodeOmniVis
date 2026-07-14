import { Command } from 'commander'
import { describe, expect, it, vi } from 'vitest'
import { mcpCommand, runMcpCommand } from '../../src/commands/mcp'

const mcpRuntime = vi.hoisted(() => ({
  start: vi.fn(async () => ({ close: vi.fn(async () => {}) })),
}))

vi.mock('@codeomnivis/mcp', () => ({ startMcpServer: mcpRuntime.start }))

describe('runMcpCommand', () => {
  it('registers the public command and starts the default MCP runtime', async () => {
    const previousSigint = new Set(process.listeners('SIGINT'))
    const previousSigterm = new Set(process.listeners('SIGTERM'))
    const program = new Command()
    mcpCommand(program)

    try {
      await program.parseAsync(['mcp', '--project', '.'], { from: 'user' })
      expect(mcpRuntime.start).toHaveBeenCalledWith({ projectRoot: process.cwd() })
    } finally {
      for (const listener of process.listeners('SIGINT')) {
        if (!previousSigint.has(listener)) process.removeListener('SIGINT', listener)
      }
      for (const listener of process.listeners('SIGTERM')) {
        if (!previousSigterm.has(listener)) process.removeListener('SIGTERM', listener)
      }
    }
  })

  it('starts once and closes cleanly on SIGTERM', async () => {
    const listeners = new Map<string, () => void>()
    const close = vi.fn(async () => {})
    const exit = vi.fn()
    const start = vi.fn(async () => ({ close }))

    await runMcpCommand(
      { project: '.' },
      {
        start,
        once: (signal, listener) => {
          listeners.set(signal, listener)
        },
        remove: vi.fn(),
        stderr: vi.fn(),
        exit,
        setExitCode: vi.fn(),
      },
    )
    listeners.get('SIGTERM')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
    expect(close).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(process.cwd())
  })

  it('removes listeners and reports a controlled startup failure', async () => {
    const remove = vi.fn()
    const stderr = vi.fn()
    const setExitCode = vi.fn()
    await runMcpCommand(
      { project: '.' },
      {
        start: async () => {
          throw new Error('boom')
        },
        once: vi.fn(),
        remove,
        stderr,
        exit: vi.fn(),
        setExitCode,
      },
    )
    expect(remove).toHaveBeenCalledTimes(2)
    expect(stderr.mock.calls.flat().join('')).toContain('Failed to start MCP Server')
    expect(setExitCode).toHaveBeenCalledWith(1)
  })

  it('reports shutdown failures without retrying the same handle', async () => {
    const listeners = new Map<string, () => void>()
    const exit = vi.fn()
    const stderr = vi.fn()
    await runMcpCommand(
      { project: '.' },
      {
        start: async () => ({
          close: async () => {
            throw new Error('close failed')
          },
        }),
        once: (signal, listener) => {
          listeners.set(signal, listener)
        },
        remove: vi.fn(),
        stderr,
        exit,
        setExitCode: vi.fn(),
      },
    )
    listeners.get('SIGINT')?.()
    listeners.get('SIGINT')?.()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
    expect(stderr.mock.calls.flat().join('')).toContain('Failed to stop MCP Server')
  })
})
