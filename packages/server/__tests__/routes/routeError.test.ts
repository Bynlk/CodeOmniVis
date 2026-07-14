import { describe, expect, it, vi } from 'vitest'
import { sendInternalError } from '../../src/routes/routeError'

describe('sendInternalError', () => {
  it('logs the private cause and returns only the controlled public envelope', () => {
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const error = new Error('private path and stack')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    sendInternalError(
      { status } as never,
      'Failed to get graph',
      'Failed to load graph data',
      error,
    )

    expect(log).toHaveBeenCalledWith('Failed to get graph:', error)
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load graph data' },
    })
  })
})
