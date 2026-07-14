import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createOmniServer, type ServerInstance } from '../../src/index'

describe('non-loopback access policy', () => {
  let server: ServerInstance | undefined

  afterEach(async () => {
    await server?.stop()
    server = undefined
  })

  it.each([
    '/api/status',
    '/api/project',
    '/api/graph',
    '/api/graph/nodes',
    '/api/graph/edges',
    '/api/graph/stats',
    '/api/graph/errors',
    '/api/graph/issues',
    '/api/graph/trace',
    '/api/graph/dataflow',
  ])('rejects anonymous remote read %s', async path => {
    server = createOmniServer({ host: '0.0.0.0', accessToken: 'remote-secret' })
    await server.db.ready()

    const response = await request(server.app).get(path)

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it.each(['/api/ai/chat', '/api/ai/explain'])('protects remote AI route %s', async path => {
    server = createOmniServer({ host: '0.0.0.0', accessToken: 'remote-secret' })
    await server.db.ready()

    const response = await request(server.app).post(path).send({})

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('accepts bearer clients on remote reads', async () => {
    server = createOmniServer({ host: '0.0.0.0', accessToken: 'remote-secret' })
    await server.db.ready()

    const response = await request(server.app)
      .get('/api/project')
      .set('Authorization', 'Bearer remote-secret')

    expect(response.status).toBe(200)
  })

  it('does not let a remote AI client reach a loopback provider', async () => {
    server = createOmniServer({ host: '0.0.0.0', accessToken: 'remote-secret' })
    await server.db.ready()

    const response = await request(server.app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer remote-secret')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        config: { baseUrl: 'http://localhost:11434/v1', apiKey: 'local', model: 'local' },
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('AI_DESTINATION_REJECTED')
  })

  it('keeps loopback reads zero-config', async () => {
    server = createOmniServer({ host: '127.0.0.1' })
    await server.db.ready()

    const response = await request(server.app).get('/api/project')

    expect(response.status).toBe(200)
  })

  it('keeps the remote health check anonymous and non-sensitive', async () => {
    server = createOmniServer({ host: '0.0.0.0', accessToken: 'remote-secret' })
    await server.db.ready()

    const response = await request(server.app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })
})
