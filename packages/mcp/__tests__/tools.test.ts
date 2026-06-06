/**
 * MCP 工具逻辑测试
 *
 * 直接测试工具逻辑，不通过 MCP transport。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { OmniDatabase } from '@omnivis/analyzer'
import type { NodeType, EdgeType } from '@omnivis/shared'

// 模拟 MCP 工具逻辑（从 index.ts 提取）
async function executeGetApiRoutes(db: OmniDatabase) {
  const apiRoutes = db.getNodesByType('api_route' as NodeType)
  const trpcProcedures = db.getNodesByType('trpc_procedure' as NodeType)
  return {
    apiRoutes: apiRoutes.map(n => ({ id: n.id, name: n.name, filePath: n.filePath, metadata: n.metadata })),
    trpcProcedures: trpcProcedures.map(n => ({ id: n.id, name: n.name, filePath: n.filePath, metadata: n.metadata })),
  }
}

async function executeGetComponentTree(db: OmniDatabase) {
  const components = db.getNodesByType('component' as NodeType)
  const rendersEdges = db.getEdgesByType('renders' as EdgeType)
  return components.map(c => ({
    id: c.id,
    name: c.name,
    filePath: c.filePath,
    children: rendersEdges.filter(e => e.source === c.id).map(e => e.target),
  }))
}

async function executeFindCallers(db: OmniDatabase, targetId: string) {
  const inEdges = db.getInEdges(targetId)
  return {
    targetId,
    callers: inEdges.map(e => ({ source: e.source, type: e.type, confidence: e.confidence })),
  }
}

describe('MCP Tools', () => {
  let db: OmniDatabase

  beforeAll(async () => {
    db = new OmniDatabase(':memory:')
    await db.ready()

    // 种入测试数据
    db.upsertNode({
      id: 'api_route:app/api/route.ts:/api/users',
      type: 'api_route',
      name: '/api/users',
      filePath: 'app/api/route.ts',
      line: 1,
      column: 1,
      metadata: { method: 'GET', route: '/api/users', isNextApiRoute: true },
    })

    db.upsertNode({
      id: 'trpc_procedure:server/routers/user.ts:user.getById',
      type: 'trpc_procedure',
      name: 'user.getById',
      filePath: 'server/routers/user.ts',
      line: 10,
      column: 1,
      metadata: { procedureType: 'query', routerName: 'user', procedureName: 'getById', hasInput: true, hasOutput: true },
    })

    db.upsertNode({
      id: 'component:app/Button.tsx:Button',
      type: 'component',
      name: 'Button',
      filePath: 'app/Button.tsx',
      line: 5,
      column: 1,
      metadata: { props: ['label'], hasState: false, isPage: false, jsxChildCount: 1 },
    })

    db.upsertNode({
      id: 'component:app/Card.tsx:Card',
      type: 'component',
      name: 'Card',
      filePath: 'app/Card.tsx',
      line: 3,
      column: 1,
      metadata: { props: ['children'], hasState: false, isPage: false, jsxChildCount: 2 },
    })

    db.upsertEdge({
      id: 'renders-1',
      source: 'component:app/Card.tsx:Card',
      target: 'component:app/Button.tsx:Button',
      type: 'renders',
      confidence: 'certain',
      metadata: { jsxLine: 10 },
    })

    db.upsertEdge({
      id: 'calls-1',
      source: 'component:app/Button.tsx:Button',
      target: 'api_route:app/api/route.ts:/api/users',
      type: 'calls_api',
      confidence: 'inferred',
      metadata: { method: 'GET', callType: 'fetch', callLine: 20 },
    })
  })

  afterAll(() => {
    db.close()
  })

  describe('getApiRoutes', () => {
    it('返回 api_route 和 trpc_procedure 节点', async () => {
      const result = await executeGetApiRoutes(db)

      expect(result.apiRoutes).toHaveLength(1)
      expect(result.apiRoutes[0].name).toBe('/api/users')
      expect(result.trpcProcedures).toHaveLength(1)
      expect(result.trpcProcedures[0].name).toBe('user.getById')
    })

    it('空数据库返回空数组', async () => {
      const emptyDb = new OmniDatabase(':memory:')
      await emptyDb.ready()

      const result = await executeGetApiRoutes(emptyDb)
      expect(result.apiRoutes).toHaveLength(0)
      expect(result.trpcProcedures).toHaveLength(0)

      emptyDb.close()
    })
  })

  describe('getComponentTree', () => {
    it('返回组件树结构', async () => {
      const tree = await executeGetComponentTree(db)

      expect(tree).toHaveLength(2)
      const card = tree.find(c => c.name === 'Card')
      expect(card).toBeDefined()
      expect(card!.children).toContain('component:app/Button.tsx:Button')
    })

    it('无子组件的节点 children 为空', async () => {
      const tree = await executeGetComponentTree(db)
      const button = tree.find(c => c.name === 'Button')
      expect(button).toBeDefined()
      expect(button!.children).toHaveLength(0)
    })
  })

  describe('findCallers', () => {
    it('返回指定节点的所有调用者', async () => {
      const result = await executeFindCallers(db, 'api_route:app/api/route.ts:/api/users')

      expect(result.callers).toHaveLength(1)
      expect(result.callers[0].source).toBe('component:app/Button.tsx:Button')
      expect(result.callers[0].type).toBe('calls_api')
    })

    it('无调用者时返回空数组', async () => {
      const result = await executeFindCallers(db, 'nonexistent')
      expect(result.callers).toHaveLength(0)
    })
  })
})
