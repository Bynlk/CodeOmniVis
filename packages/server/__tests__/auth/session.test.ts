import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createOmniServer, type ServerInstance } from '../../src/index'
import { SessionStore } from '../../src/sessionStore'

function readSetCookies(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  throw new Error('expected one or more Set-Cookie headers')
}

describe('remote browser sessions', () => {
  let server: ServerInstance | undefined

  afterEach(async () => {
    await server?.stop()
    server = undefined
  })

  it('issues an HttpOnly strict cookie without echoing the access token', async () => {
    const accessToken = 'remote-secret-token'
    server = createOmniServer({
      host: '0.0.0.0',
      accessToken,
      secureCookies: true,
    })
    await server.db.ready()

    const response = await request(server.app).post('/api/session').send({ accessToken })

    expect(response.status).toBe(200)
    const cookies = readSetCookies(response.headers['set-cookie'])
    expect(cookies.join(';')).toContain('HttpOnly')
    expect(cookies.join(';')).toContain('SameSite=Strict')
    expect(cookies.join(';')).toContain('Secure')
    expect(JSON.stringify(response.body)).not.toContain(accessToken)
  })

  it('authorizes REST reads with the issued session cookie', async () => {
    const accessToken = 'remote-secret-token'
    server = createOmniServer({ host: '0.0.0.0', accessToken })
    await server.db.ready()
    const login = await request(server.app).post('/api/session').send({ accessToken })
    const cookie = readSetCookies(login.headers['set-cookie'])[0].split(';', 1)[0]

    const response = await request(server.app).get('/api/project').set('Cookie', cookie)

    expect(response.status).toBe(200)
  })

  it('rejects an incorrect access token without creating a cookie', async () => {
    server = createOmniServer({ host: '0.0.0.0', accessToken: 'correct-token' })
    await server.db.ready()

    const response = await request(server.app)
      .post('/api/session')
      .send({ accessToken: 'wrong-token' })

    expect(response.status).toBe(401)
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })
})

describe('SessionStore', () => {
  it('expires sessions at the absolute TTL without sliding renewal', () => {
    const store = new SessionStore({ ttlMs: 1_000, maxSessions: 2 })
    const session = store.create(5_000)

    expect(store.validate(session.id, 5_999)).toBe(true)
    expect(store.validate(session.id, 6_000)).toBe(false)
    store.dispose()
  })

  it('evicts the oldest session at the configured cap', () => {
    const store = new SessionStore({ ttlMs: 10_000, maxSessions: 2 })
    const first = store.create(1)
    const second = store.create(2)
    const third = store.create(3)

    expect(store.validate(first.id, 4)).toBe(false)
    expect(store.validate(second.id, 4)).toBe(true)
    expect(store.validate(third.id, 4)).toBe(true)
    store.dispose()
  })
})
