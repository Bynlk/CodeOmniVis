/**
 * H8 · S-03 安全响应头测试。
 *
 * 所有响应应携带基础安全响应头,降低 MIME 嗅探/点击劫持/Referrer 泄露风险。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createOmniServer } from '../../src/index'

describe('security response headers (S-03)', () => {
  let server: ReturnType<typeof createOmniServer>

  beforeEach(async () => {
    server = createOmniServer({ projectRoot: process.cwd(), dbPath: ':memory:' })
    await server.db.ready()
  })

  afterEach(() => {
    server.db.close()
  })

  it('sets X-Content-Type-Options nosniff on API responses', async () => {
    const res = await request(server.app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('sets X-Frame-Options and Referrer-Policy', async () => {
    const res = await request(server.app).get('/api/health')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
  })

  it('does not leak X-Powered-By', async () => {
    const res = await request(server.app).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
