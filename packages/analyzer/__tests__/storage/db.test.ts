/**
 * OmniDatabase 单元测试
 *
 * 测试存储层的核心功能：
 * - 节点的增删改查
 * - 边的增删改查
 * - 图的保存和加载
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OmniDatabase } from '../../src/storage/db'
import type { DbError } from '../../src/storage/db'
import type { OmniNode, OmniEdge } from '@codeomnivis/shared'

// ============================================================
// 测试数据
// ============================================================

const testNode: OmniNode = {
  id: 'db_model:prisma/schema.prisma:User',
  type: 'db_model',
  name: 'User',
  filePath: 'prisma/schema.prisma',
  line: 10,
  column: 1,
  metadata: {
    tableName: 'users',
    fieldCount: 5,
    fields: [{ name: 'id', type: 'String', isRequired: true, isId: true, isRelation: false }],
  },
}

const testNode2: OmniNode = {
  id: 'page:app/booking/page.tsx:/booking',
  type: 'page',
  name: '/booking',
  filePath: 'app/booking/page.tsx',
  line: 1,
  column: 1,
  metadata: {
    route: '/booking',
    isDynamic: false,
    params: [],
    isGroupLayout: false,
    layoutFile: null,
  },
}

const testEdge: OmniEdge = {
  id: 'db_model:prisma/schema.prisma:User--queries_db--page:app/booking/page.tsx:/booking',
  source: 'db_model:prisma/schema.prisma:User',
  target: 'page:app/booking/page.tsx:/booking',
  type: 'queries_db',
  confidence: 'inferred',
  metadata: {
    operation: 'findMany',
    callLine: 15,
  },
}

// ============================================================
// 测试套件
// ============================================================

describe('OmniDatabase', () => {
  let db: OmniDatabase

  beforeEach(async () => {
    db = new OmniDatabase()
    await db.ready()
  })

  afterEach(() => {
    db.close()
  })

  // ============================================================
  // 节点操作测试
  // ============================================================

  describe('Node Operations', () => {
    it('should insert and retrieve a node', () => {
      const result = db.upsertNode(testNode)
      expect(result).toBe(true)

      const retrieved = db.getNode(testNode.id)
      expect(retrieved).toEqual(testNode)
    })

    it('preserves tRPC router container identity across storage', () => {
      const routerNode: OmniNode = {
        id: 'trpc_procedure:server/routers/booking.ts:bookingRouter',
        type: 'trpc_procedure',
        name: 'bookingRouter',
        filePath: 'server/routers/booking.ts',
        line: 1,
        column: 1,
        metadata: {
          procedureType: 'query',
          routerName: 'booking',
          procedureName: 'bookingRouter',
          hasInput: false,
          hasOutput: false,
          isRouter: true,
        },
      }

      db.upsertNode(routerNode)

      expect(db.getNode(routerNode.id)).toEqual(routerNode)
    })

    it('should update an existing node', () => {
      db.upsertNode(testNode)

      const updatedNode = { ...testNode, line: 20 }
      db.upsertNode(updatedNode)

      const retrieved = db.getNode(testNode.id)
      expect(retrieved?.line).toBe(20)
    })

    it('should return null for non-existent node', () => {
      const retrieved = db.getNode('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('should get all nodes', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)

      const nodes = db.getAllNodes()
      expect(nodes).toHaveLength(2)
    })

    it('should get nodes by type', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)

      const dbModels = db.getNodesByType('db_model')
      expect(dbModels).toHaveLength(1)
      expect(dbModels[0].type).toBe('db_model')

      const pages = db.getNodesByType('page')
      expect(pages).toHaveLength(1)
      expect(pages[0].type).toBe('page')
    })

    it('should get nodes by file path', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)

      const nodes = db.getNodesByFile('prisma/schema.prisma')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].filePath).toBe('prisma/schema.prisma')
    })

    it('should delete a node', () => {
      db.upsertNode(testNode)
      const result = db.deleteNode(testNode.id)
      expect(result).toBe(true)

      const retrieved = db.getNode(testNode.id)
      expect(retrieved).toBeNull()
    })

    it('should batch insert nodes', () => {
      const count = db.upsertNodes([testNode, testNode2])
      expect(count).toBe(2)

      const nodes = db.getAllNodes()
      expect(nodes).toHaveLength(2)
    })
  })

  // ============================================================
  // 边操作测试
  // ============================================================

  describe('Edge Operations', () => {
    it('should insert and retrieve an edge', () => {
      // 先插入源节点和目标节点
      db.upsertNode(testNode)
      db.upsertNode(testNode2)

      const result = db.upsertEdge(testEdge)
      expect(result).toBe(true)

      const retrieved = db.getEdge(testEdge.id)
      expect(retrieved).toEqual(testEdge)
    })

    it('should get all edges', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const edges = db.getAllEdges()
      expect(edges).toHaveLength(1)
    })

    it('should get edges by type', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const edges = db.getEdgesByType('queries_db')
      expect(edges).toHaveLength(1)
      expect(edges[0].type).toBe('queries_db')
    })

    it('should get out edges for a node', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const edges = db.getOutEdges(testNode.id)
      expect(edges).toHaveLength(1)
      expect(edges[0].source).toBe(testNode.id)
    })

    it('should get in edges for a node', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const edges = db.getInEdges(testNode2.id)
      expect(edges).toHaveLength(1)
      expect(edges[0].target).toBe(testNode2.id)
    })

    it('should delete an edge', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const result = db.deleteEdge(testEdge.id)
      expect(result).toBe(true)

      const retrieved = db.getEdge(testEdge.id)
      expect(retrieved).toBeNull()
    })

    it('should batch insert edges', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)

      const count = db.upsertEdges([testEdge])
      expect(count).toBe(1)

      const edges = db.getAllEdges()
      expect(edges).toHaveLength(1)
    })
  })

  // ============================================================
  // 图操作测试
  // ============================================================

  describe('Graph Operations', () => {
    it('should save and load a graph', () => {
      const graph = {
        nodes: [testNode, testNode2],
        edges: [testEdge],
      }

      const { nodesSaved, edgesSaved } = db.saveGraph(graph)
      expect(nodesSaved).toBe(2)
      expect(edgesSaved).toBe(1)

      const loaded = db.loadGraph()
      expect(loaded.nodes).toHaveLength(2)
      expect(loaded.edges).toHaveLength(1)
    })

    it('should clear the graph', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const result = db.clearGraph()
      expect(result).toBe(true)

      const stats = db.getStats()
      expect(stats.nodeCount).toBe(0)
      expect(stats.edgeCount).toBe(0)
    })

    it('supports compatibility lookups, traversal, subtrees, and typed batches', () => {
      db.upsertNodes([testNode, testNode2])
      db.upsertEdge(testEdge)

      expect(db.getNodesByTypes(['db_model', 'page'])).toHaveLength(2)
      expect(db.findNodeByRoute('/booking')?.id).toBe(testNode2.id)
      expect(db.findNodeByFilePath(testNode.filePath)?.id).toBe(testNode.id)
      expect(db.findNodeByAny('/booking')?.id).toBe(testNode2.id)
      expect(db.findNodeByAny('User')?.id).toBe(testNode.id)
      expect(db.getDownstreamNodes(testNode.id, ['queries_db']).map((node) => node.id)).toEqual([
        testNode2.id,
      ])
      expect(db.getUpstreamNodes(testNode2.id).map((node) => node.id)).toEqual([testNode.id])
      expect(db.getSubtree(testNode.id, 'queries_db', 2)?.children[0]?.id).toBe(testNode2.id)
      expect(db.getAffectedPages(testNode2.id)).toEqual([])
      expect(db.removeDanglingEdges()).toBe(0)
    })

    it('clears node, edge, and error collections independently', () => {
      db.upsertNodes([testNode, testNode2])
      db.upsertEdge(testEdge)
      db.insertError({ file: 'test.ts', message: 'bad', severity: 'warning' })

      expect(db.deleteAllEdges()).toBe(true)
      expect(db.deleteAllErrors()).toBe(true)
      expect(db.deleteAllNodes()).toBe(true)
      expect(db.loadGraph()).toEqual({ nodes: [], edges: [] })
      expect(db.getAllErrors()).toEqual([])
    })
  })

  // ============================================================
  // 错误处理测试
  // ============================================================

  describe('Error Handling', () => {
    it('should insert and retrieve errors', () => {
      const error: DbError = {
        file: 'test.ts',
        message: 'Parse failed',
        severity: 'warning',
      }

      const result = db.insertError(error)
      expect(result).toBe(true)

      const errors = db.getAllErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].file).toBe('test.ts')
    })

    it('should batch insert errors', () => {
      const errors: DbError[] = [
        { file: 'test1.ts', message: 'Error 1', severity: 'error' },
        { file: 'test2.ts', message: 'Error 2', severity: 'warning' },
      ]

      const count = db.insertErrors(errors)
      expect(count).toBe(2)

      const allErrors = db.getAllErrors()
      expect(allErrors).toHaveLength(2)
    })
  })

  // ============================================================
  // 统计查询测试
  // ============================================================

  describe('Statistics', () => {
    it('should return correct stats', () => {
      db.upsertNode(testNode)
      db.upsertNode(testNode2)
      db.upsertEdge(testEdge)

      const stats = db.getStats()
      expect(stats.nodeCount).toBe(2)
      expect(stats.edgeCount).toBe(1)
      expect(stats.nodeTypeCounts['db_model']).toBe(1)
      expect(stats.nodeTypeCounts['page']).toBe(1)
      expect(stats.edgeTypeCounts['queries_db']).toBe(1)
    })
  })

  // ============================================================
  // 元数据操作测试
  // ============================================================

  describe('Metadata Operations', () => {
    it('should set and get metadata', () => {
      db.setMeta('lastAnalysis', '2024-01-01')
      const value = db.getMeta('lastAnalysis')
      expect(value).toBe('2024-01-01')
    })

    it('should return null for non-existent metadata', () => {
      const value = db.getMeta('non-existent')
      expect(value).toBeNull()
    })
  })
})
