/**
 * H4 · S-04 WebSocket Origin 校验测试。
 *
 * 启动真实 HTTP+WS 服务(ephemeral 端口),用 ws 客户端携带不同 Origin 头发起握手:
 * 白名单内 Origin 正常建连;白名单外 Origin 升级被拒(握手错误,连接打不开)。
 * 无 Origin(非浏览器客户端)放行。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import WebSocket from 'ws'
import { createOmniServer } from '../../src/index'

const ALLOWED = 'http://localhost:5173'

function connect(url: string, origin?: string): Promise<'open' | 'rejected'> {
  return new Promise((resolve) => {
    const ws = origin === undefined
      ? new WebSocket(url)
      : new WebSocket(url, { origin })
    ws.on('open', () => {
      ws.close()
      resolve('open')
    })
    ws.on('error', () => {
      resolve('rejected')
    })
    ws.on('unexpected-response', () => {
      resolve('rejected')
    })
  })
}

describe('WebSocket Origin guard', () => {
  let server: ReturnType<typeof createOmniServer>
  let wsUrl: string

  beforeAll(async () => {
    server = createOmniServer({
      projectRoot: process.cwd(),
      dbPath: ':memory:',
      port: 0,
      corsOrigin: ALLOWED,
    })
    await server.db.ready()
    await new Promise<void>((resolve) => {
      server.server.listen(0, '127.0.0.1', () => resolve())
    })
    const addr = server.server.address()
    if (addr === null || typeof addr === 'string') {
      throw new Error('expected an AddressInfo from server.address()')
    }
    wsUrl = `ws://127.0.0.1:${addr.port}/ws`
  })

  afterAll(async () => {
    await server.stop()
  })

  it('rejects an upgrade with a disallowed Origin', async () => {
    const result = await connect(wsUrl, 'http://evil.example.com')
    expect(result).toBe('rejected')
  })

  it('accepts an upgrade with an allowed Origin', async () => {
    const result = await connect(wsUrl, ALLOWED)
    expect(result).toBe('open')
  })

  it('accepts the equivalent loopback host with the allowed protocol and port', async () => {
    const result = await connect(wsUrl, 'http://127.0.0.1:5173')
    expect(result).toBe('open')
  })

  it('accepts a connection with no Origin (non-browser client)', async () => {
    const result = await connect(wsUrl)
    expect(result).toBe('open')
  })
})
