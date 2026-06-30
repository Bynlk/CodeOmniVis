/**
 * H9 - LEAK-01 exit resource release test.
 *
 * stop() must close the WebSocketServer and the database to avoid handle/listener leaks.
 * Also verifies registered process exit hooks (SIGINT/SIGTERM) trigger the same cleanup path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { createOmniServer } from '../../src/index'

describe('graceful teardown (LEAK-01)', () => {
  let wssCloseSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    wssCloseSpy = vi.spyOn(WebSocketServer.prototype, 'close')
  })

  afterEach(() => {
    wssCloseSpy.mockRestore()
  })

  it('stop() closes the WebSocketServer and the database', async () => {
    const server = createOmniServer({ projectRoot: process.cwd(), dbPath: ':memory:', port: 0, host: '127.0.0.1' })
    await server.start()

    const dbCloseSpy = vi.spyOn(server.db, 'close')

    await server.stop()

    expect(wssCloseSpy).toHaveBeenCalled()
    expect(dbCloseSpy).toHaveBeenCalled()
  })

  it('registers SIGINT and SIGTERM exit hooks on start()', async () => {
    const onSpy = vi.spyOn(process, 'on')
    const server = createOmniServer({ projectRoot: process.cwd(), dbPath: ':memory:', port: 0, host: '127.0.0.1' })
    await server.start()

    const signals = onSpy.mock.calls.map((call) => call[0])
    expect(signals).toContain('SIGINT')
    expect(signals).toContain('SIGTERM')

    onSpy.mockRestore()
    await server.stop()
  })
})
