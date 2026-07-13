/**
 * 图数据 API 路由测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import type { OmniNode, OmniEdge } from '@codeomnivis/shared'
import { createGraphRouter } from '../../src/routes/graph'

// 测试用节点
const testNode: OmniNode = {
  id: 'page:app/page.tsx:/',
  type: 'page',
  name: 'HomePage',
  filePath: 'app/page.tsx',
  line: 1,
  column: 1,
  metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
}

const testNode2: OmniNode = {
  id: 'component:app/Button.tsx:Button',
  type: 'component',
  name: 'Button',
  filePath: 'app/Button.tsx',
  line: 5,
  column: 1,
  metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
}

const testEdge: OmniEdge = {
  id: 'edge-1',
  source: 'page:app/page.tsx:/',
  target: 'component:app/Button.tsx:Button',
  type: 'renders',
  confidence: 'certain',
  metadata: {},
}

describe('Graph Routes', () => {
  let db: OmniDatabase
  let app: express.Express

  beforeAll(async () => {
    db = new OmniDatabase(':memory:')
    await db.ready()

    // 种入测试数据
    db.upsertNode(testNode)
    db.upsertNode(testNode2)
    db.upsertEdge(testEdge)
    db.insertError({
      file: 'test.ts',
      message: 'parse error',
      severity: 'warning',
    })

    // 创建 Express app
    app = express()
    app.use(express.json())
    app.use('/api/graph', createGraphRouter(db))
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() })
    })
  })

  afterAll(() => {
    db.close()
  })

  // ──────────────────────────────────────────
  // GET /api/graph
  // ──────────────────────────────────────────

  describe('GET /api/graph', () => {
    it('返回图数据和 meta', async () => {
      const res = await request(app).get('/api/graph')

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()
      expect(res.body.data.nodes).toHaveLength(2)
      expect(res.body.data.edges).toHaveLength(1)
      expect(res.body.meta.nodeCount).toBe(2)
      expect(res.body.meta.edgeCount).toBe(1)
    })
  })

  // ──────────────────────────────────────────
  // GET /api/graph/nodes
  // ──────────────────────────────────────────

  describe('GET /api/graph/nodes', () => {
    it('返回所有节点', async () => {
      const res = await request(app).get('/api/graph/nodes')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.meta.count).toBe(2)
    })

    it('按类型过滤节点', async () => {
      const res = await request(app).get('/api/graph/nodes?type=page')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].type).toBe('page')
    })

    it('无效类型返回 400', async () => {
      const res = await request(app).get('/api/graph/nodes?type=invalid')

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_TYPE')
    })
  })

  // ──────────────────────────────────────────
  // GET /api/graph/nodes/:id
  // ──────────────────────────────────────────

  describe('GET /api/graph/nodes/:id', () => {
    it('返回指定节点', async () => {
      const encodedId = encodeURIComponent('page:app/page.tsx:/')
      const res = await request(app).get(`/api/graph/nodes/${encodedId}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(testNode.id)
      expect(res.body.data.name).toBe('HomePage')
    })

    it('不存在的节点返回 404', async () => {
      const res = await request(app).get('/api/graph/nodes/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })

  // ──────────────────────────────────────────
  // GET /api/graph/nodes/:id/edges
  // ──────────────────────────────────────────

  describe('GET /api/graph/nodes/:id/edges', () => {
    it('返回节点的入边和出边', async () => {
      const encodedId = encodeURIComponent('page:app/page.tsx:/')
      const res = await request(app).get(`/api/graph/nodes/${encodedId}/edges`)

      expect(res.status).toBe(200)
      expect(res.body.data.outEdges).toHaveLength(1)
      expect(res.body.data.inEdges).toHaveLength(0)
      expect(res.body.meta.outCount).toBe(1)
      expect(res.body.meta.inCount).toBe(0)
    })
  })

  // ──────────────────────────────────────────
  // GET /api/graph/stats
  // ──────────────────────────────────────────

  describe('GET /api/graph/stats', () => {
    it('返回统计信息', async () => {
      const res = await request(app).get('/api/graph/stats')

      expect(res.status).toBe(200)
      expect(res.body.data.nodeCount).toBe(2)
      expect(res.body.data.edgeCount).toBe(1)
      expect(res.body.data.nodeTypeCounts.page).toBe(1)
      expect(res.body.data.nodeTypeCounts.component).toBe(1)
    })
  })

  // ──────────────────────────────────────────
  // GET /api/graph/errors
  // ──────────────────────────────────────────

  describe('GET /api/graph/errors', () => {
    it('返回解析错误列表', async () => {
      const res = await request(app).get('/api/graph/errors')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].file).toBe('test.ts')
      expect(res.body.meta.count).toBe(1)
    })
  })

  // ──────────────────────────────────────────
  // DELETE /api/graph
  // ──────────────────────────────────────────

  describe('DELETE /api/graph', () => {
    it('无 X-Confirm header 返回 400', async () => {
      const res = await request(app).delete('/api/graph')

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('CONFIRMATION_REQUIRED')
    })
  })

  // ──────────────────────────────────────────
  // GET /api/health
  // ──────────────────────────────────────────

  describe('GET /api/health', () => {
    it('返回 ok', async () => {
      const res = await request(app).get('/api/health')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
    })
  })
})

describe('GET /api/graph/issues', () => {
  it('returns sourced project issues and detector status metadata', async () => {
    const issueDb = new OmniDatabase(':memory:')
    await issueDb.ready()

    const routerNode: OmniNode = {
      id: 'trpc_procedure:server/router.ts:demoRouter',
      type: 'trpc_procedure',
      name: 'demoRouter',
      filePath: 'server/router.ts',
      line: 1,
      column: 1,
      metadata: {
        procedureType: 'query',
        routerName: 'demo',
        procedureName: 'demoRouter',
        hasInput: false,
        hasOutput: false,
        isRouter: true,
      },
    }
    const procedureNode: OmniNode = {
      id: 'trpc_procedure:server/router.ts:list',
      type: 'trpc_procedure',
      name: 'list',
      filePath: 'server/router.ts',
      line: 2,
      column: 1,
      metadata: {
        procedureType: 'query',
        routerName: 'demo',
        procedureName: 'list',
        hasInput: false,
        hasOutput: false,
      },
    }
    issueDb.upsertNode(routerNode)
    issueDb.upsertNode(procedureNode)
    issueDb.upsertEdge({
      id: 'contains-demo-list',
      source: routerNode.id,
      target: procedureNode.id,
      type: 'contains',
      confidence: 'certain',
      metadata: { routerName: 'demo', procedureName: 'list' },
    })

    const issueApp = express()
    issueApp.use('/api/graph', createGraphRouter(issueDb, undefined, () => '/project'))
    const res = await request(issueApp).get('/api/graph/issues')
    issueDb.close()

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'consistency', type: 'dead_route' }),
    ]))
    expect(res.body.meta).toMatchObject({ count: 1, warning: 1 })
    expect(res.body.meta.detectors).toHaveLength(4)
  })
})
