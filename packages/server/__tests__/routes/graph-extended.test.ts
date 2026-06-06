/**
 * 图数据 API 路由扩展测试
 * 覆盖原测试未覆盖的路由
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { OmniDatabase } from '@omnivis/analyzer'
import type { OmniEdge } from '@omnivis/shared'
import { createGraphRouter } from '../../src/routes/graph'

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
      metadata: {},
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
    it('有 X-Confirm header 时清空图', async () => {
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
})
