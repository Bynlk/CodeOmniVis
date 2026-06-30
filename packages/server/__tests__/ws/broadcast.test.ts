/**
 * H10 - MAGIC-02 broadcast test.
 *
 * Graph-update broadcast must reach OPEN WebSocket clients. This pins the behavior
 * after replacing the literal readyState===1 with the WebSocket.OPEN constant.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import WebSocket from 'ws'
import { createOmniServer } from '../../src/index'
import { codeomnivisEvents, EVENTS } from '../../src/events'

describe('WebSocket broadcast (MAGIC-02)', () => {
  let server: ReturnType<typeof createOmniServer>
  let wsUrl: string

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    server = createOmniServer({
      projectRoot: process.cwd(),
      dbPath: ':memory:',
      port: 0,
      host: '127.0.0.1',
      corsOrigin: 'http://localhost:5173',
    })
    await server.start()
    const addr = server.server.address()
    if (addr === null || typeof addr === 'string') {
      throw new Error('expected an AddressInfo from server.address()')
    }
    wsUrl = `ws://127.0.0.1:${addr.port}/ws`
  })

  afterEach(async () => {
    await server.stop()
  })

  it('delivers a graph_updated message to an OPEN client', async () => {
    const received = await new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { origin: 'http://localhost:5173' })
      const timer = setTimeout(() => reject(new Error('no broadcast received')), 3000)
      ws.on('open', () => {
        codeomnivisEvents.emit(EVENTS.GRAPH_UPDATED)
      })
      ws.on('message', (data) => {
        clearTimeout(timer)
        ws.close()
        resolve(data.toString())
      })
      ws.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    const parsed: unknown = JSON.parse(received)
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
      throw new Error('unexpected broadcast payload shape')
    }
    expect(parsed.type).toBe('graph_updated')
  })
})
