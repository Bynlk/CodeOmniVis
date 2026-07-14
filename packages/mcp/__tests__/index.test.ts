import { describe, expect, it, vi } from 'vitest'
import { isMainModule, runMcpProcess } from '../src/index'

function createRuntime() {
  const listeners = new Map<string, () => void>()
  const exits: number[] = []
  const errors: string[] = []
  return {
    listeners,
    exits,
    errors,
    runtime: {
      env: { CODEOMNIVIS_PROJECT: '/project' },
      cwd: () => '/cwd',
      once: (event: 'SIGINT' | 'SIGTERM', listener: () => void) => {
        listeners.set(event, listener)
      },
      exit: (code: number) => {
        exits.push(code)
      },
      stderr: {
        write: (message: string) => {
          errors.push(message)
          return true
        },
      },
    },
  }
}

describe('MCP direct process lifecycle', () => {
  it('identifies the direct module without relying on global argv in tests', () => {
    expect(isMainModule(undefined, 'file:///entry.js')).toBe(false)
    expect(isMainModule('/entry.js', 'file:///entry.js')).toBe(true)
  })

  it('closes a started server on SIGTERM and exits cleanly', async () => {
    const state = createRuntime()
    const close = vi.fn(async () => {})
    runMcpProcess(state.runtime, async () => ({ close }))
    await Promise.resolve()
    state.listeners.get('SIGTERM')?.()
    expect(close).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(state.exits).toEqual([0]))
  })

  it('preserves an early stop request until startup completes', async () => {
    const state = createRuntime()
    let resolveStart: ((handle: { close: () => Promise<void> }) => void) | undefined
    const started = new Promise<{ close: () => Promise<void> }>((resolve) => {
      resolveStart = resolve
    })
    const close = vi.fn(async () => {})
    runMcpProcess(state.runtime, () => started)
    state.listeners.get('SIGINT')?.()
    resolveStart?.({ close })
    await Promise.resolve()
    await Promise.resolve()
    expect(close).toHaveBeenCalledOnce()
  })

  it('reports startup failures without leaking them to stdout', async () => {
    const state = createRuntime()
    runMcpProcess(state.runtime, async () => {
      throw new Error('startup failed')
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(state.errors.join('')).toContain('[codeomnivis-mcp] Fatal: Error: startup failed')
    expect(state.exits).toEqual([1])
  })

  it('reports shutdown failures and exits non-zero', async () => {
    const state = createRuntime()
    runMcpProcess(state.runtime, async () => ({
      close: async () => {
        throw new Error('close failed')
      },
    }))
    await Promise.resolve()
    state.listeners.get('SIGTERM')?.()
    await vi.waitFor(() => expect(state.exits).toEqual([1]))
    expect(state.errors.join('')).toContain(
      '[codeomnivis-mcp] Shutdown failed: Error: close failed',
    )
  })
})
