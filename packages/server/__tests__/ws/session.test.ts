import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createOmniServer } from '../../src/index'

const ALLOWED_ORIGIN = 'http://localhost:5173'
const ACCESS_TOKEN = 'remote-websocket-secret'

function connect(url: string, headers: Record<string, string> = {}): Promise<'open' | 'rejected'> {
  return new Promise((resolveConnection) => {
    const ws = new WebSocket(url, { origin: ALLOWED_ORIGIN, headers })
    ws.on('open', () => {
      ws.close()
      resolveConnection('open')
    })
    ws.on('error', () => resolveConnection('rejected'))
    ws.on('unexpected-response', () => resolveConnection('rejected'))
  })
}

describe('remote WebSocket session policy', () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'codeomnivis-ws-session-'))
  const server = createOmniServer({
    host: '0.0.0.0',
    port: 0,
    projectRoot,
    accessToken: ACCESS_TOKEN,
    corsOrigin: ALLOWED_ORIGIN,
  })
  let httpUrl: string
  let wsUrl: string

  beforeAll(async () => {
    await server.start()
    const address = server.server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected an AddressInfo from server.address()')
    }
    httpUrl = `http://127.0.0.1:${address.port}`
    wsUrl = `ws://127.0.0.1:${address.port}/ws`
  })

  afterAll(async () => {
    await server.stop()
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it('rejects an anonymous remote connection even with an allowed Origin', async () => {
    expect(await connect(wsUrl)).toBe('rejected')
  })

  it('accepts a bearer-authenticated non-browser client', async () => {
    expect(await connect(wsUrl, { Authorization: `Bearer ${ACCESS_TOKEN}` })).toBe('open')
  })

  it('accepts the same session cookie issued to the browser', async () => {
    const response = await fetch(`${httpUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: ACCESS_TOKEN }),
    })
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
    if (!cookie) throw new Error('expected session cookie')

    expect(await connect(wsUrl, { Cookie: cookie })).toBe('open')
  })
})
