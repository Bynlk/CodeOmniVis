/**
 * 图数据 API 路由扩展测试
 * 覆盖原测试未覆盖的路由
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import type { OmniEdge } from '@codeomnivis/shared'
import { createGraphRouter } from '../../src/routes/graph'
import { createMutatingGuard } from '../../src/authGuard'

describe('Graph Routes — Extended', () => {
  let db: OmniDatabase
  let app: express.Express

  beforeAll(async () => {
    db = new OmniDatabase(':memory:')
    await db.ready()

    // 种入测试数据
    db.upsertNode({
      id: 'page:app/page.tsx:/',
      type: 'page',
      name: 'HomePage',
      filePath: 'app/page.tsx',
      line: 1,
      column: 1,
      metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
    })

    const edge: OmniEdge = {
      id: 'edge-1',
      source: 'page:app/page.tsx:/',
      target: 'page:app/page.tsx:/',
      type: 'renders',
      confidence: 'certain',
      metadata: {},
    }
    db.upsertEdge(edge)

    app = express()
    app.use(express.json())
    app.use('/api/graph', createGraphRouter(db))
  })

  afterAll(() => {
    db.close()
  })

  // ──────────────────────────────────────────
  // GET /api/graph/edges
  // ──────────────────────────────────────────

  describe('GET /api/graph/edges', () => {
    it('返回所有边', async () => {
      const res = await request(app).get('/api/graph/edges')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.meta.count).toBe(1)
    })

    it('按类型过滤边', async () => {
      const res = await request(app).get('/api/graph/edges?type=renders')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
    })

    it('无效边类型返回 400', async () => {
      const res = await request(app).get('/api/graph/edges?type=invalid')

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_TYPE')
    })
  })

  // ──────────────────────────────────────────
  // DELETE /api/graph 成功
  // ──────────────────────────────────────────

  describe('DELETE /api/graph with X-Confirm', () => {
    it('有 X-Confirm header 时清空图(loopback 放行)', async () => {
      const res = await request(app)
        .delete('/api/graph')
        .set('X-Confirm', 'true')

      expect(res.status).toBe(200)
      expect(res.body.data.success).toBe(true)

      // 验证图已清空
      const graphRes = await request(app).get('/api/graph')
      expect(graphRes.body.data.nodes).toHaveLength(0)
      expect(graphRes.body.data.edges).toHaveLength(0)
    })
  })

  // ──────────────────────────────────────────
  // S-07:非 loopback 绑定时 DELETE 需要鉴权 token
  // ──────────────────────────────────────────

  describe('DELETE /api/graph — non-loopback auth (S-07)', () => {
    let authDb: OmniDatabase
    let authApp: express.Express
    const TOKEN = 'secret-token-123'

    beforeAll(async () => {
      authDb = new OmniDatabase(':memory:')
      await authDb.ready()
      authApp = express()
      authApp.use(express.json())
      // 模拟绑定到 0.0.0.0(非 loopback)且配置了 token 的服务器。
      const guard = createMutatingGuard({ host: '0.0.0.0', token: TOKEN })
      authApp.use('/api/graph', createGraphRouter(authDb, guard))
    })

    afterAll(() => {
      authDb.close()
    })

    it('无 token 时即便带 X-Confirm 也被拒(401)', async () => {
      const res = await request(authApp)
        .delete('/api/graph')
        .set('X-Confirm', 'true')
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('错误 token 被拒(401)', async () => {
      const res = await request(authApp)
        .delete('/api/graph')
        .set('Authorization', 'Bearer wrong-token')
        .set('X-Confirm', 'true')
      expect(res.status).toBe(401)
    })

    it('有效 Bearer token + X-Confirm 通过(200)', async () => {
      const res = await request(authApp)
        .delete('/api/graph')
        .set('Authorization', `Bearer ${TOKEN}`)
        .set('X-Confirm', 'true')
      expect(res.status).toBe(200)
      expect(res.body.data.success).toBe(true)
    })

    it('非 loopback 但未配置 token 时一律 403', async () => {
      const noTokenDb = new OmniDatabase(':memory:')
      await noTokenDb.ready()
      const app2 = express()
      app2.use(express.json())
      app2.use('/api/graph', createGraphRouter(noTokenDb, createMutatingGuard({ host: '0.0.0.0' })))
      const res = await request(app2)
        .delete('/api/graph')
        .set('X-Confirm', 'true')
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('AUTH_NOT_CONFIGURED')
      noTokenDb.close()
    })
  })
})
