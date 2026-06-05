/**
 * 图数据 API 路由
 *
 * 提供图数据的 CRUD 操作。
 * 遵循 REST API 格式规范。
 */

import { Router, Request, Response } from 'express'
import type { OmniDatabase } from '@omnivis/analyzer'
import type { NodeType, EdgeType } from '@omnivis/shared'

// ============================================================
// 路由创建
// ============================================================

export function createGraphRouter(db: OmniDatabase): Router {
  const router = Router()

  /**
   * GET /api/graph
   * 获取完整的图数据
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const graph = db.loadGraph()
      const stats = db.getStats()

      res.json({
        data: graph,
        meta: {
          nodeCount: stats.nodeCount,
          edgeCount: stats.edgeCount,
          nodesByType: stats.nodeTypeCounts,
          edgesByType: stats.edgeTypeCounts,
        },
      })
    } catch (err) {
      console.error('Failed to get graph:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load graph data',
        },
      })
    }
  })

  /**
   * GET /api/graph/nodes
   * 获取所有节点，支持按类型过滤
   */
  router.get('/nodes', (req: Request, res: Response) => {
    try {
      const { type } = req.query

      let nodes
      if (type && typeof type === 'string') {
        nodes = db.getNodesByType(type as NodeType)
      } else {
        nodes = db.getAllNodes()
      }

      res.json({
        data: nodes,
        meta: { count: nodes.length },
      })
    } catch (err) {
      console.error('Failed to get nodes:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load nodes',
        },
      })
    }
  })

  /**
   * GET /api/graph/nodes/:id
   * 获取单个节点
   */
  router.get('/nodes/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const node = db.getNode(decodeURIComponent(id))

      if (!node) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Node not found: ${id}`,
          },
        })
      }

      res.json({ data: node })
    } catch (err) {
      console.error('Failed to get node:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load node',
        },
      })
    }
  })

  /**
   * GET /api/graph/nodes/:id/edges
   * 获取节点的所有边（入边和出边）
   */
  router.get('/nodes/:id/edges', (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const nodeId = decodeURIComponent(id)

      const inEdges = db.getInEdges(nodeId)
      const outEdges = db.getOutEdges(nodeId)

      res.json({
        data: {
          inEdges,
          outEdges,
        },
        meta: {
          inCount: inEdges.length,
          outCount: outEdges.length,
        },
      })
    } catch (err) {
      console.error('Failed to get node edges:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load node edges',
        },
      })
    }
  })

  /**
   * GET /api/graph/edges
   * 获取所有边，支持按类型过滤
   */
  router.get('/edges', (req: Request, res: Response) => {
    try {
      const { type } = req.query

      let edges
      if (type && typeof type === 'string') {
        edges = db.getEdgesByType(type as EdgeType)
      } else {
        edges = db.getAllEdges()
      }

      res.json({
        data: edges,
        meta: { count: edges.length },
      })
    } catch (err) {
      console.error('Failed to get edges:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load edges',
        },
      })
    }
  })

  /**
   * GET /api/graph/stats
   * 获取图统计信息
   */
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const stats = db.getStats()
      res.json({ data: stats })
    } catch (err) {
      console.error('Failed to get stats:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load stats',
        },
      })
    }
  })

  /**
   * DELETE /api/graph
   * 清空图数据
   */
  router.delete('/', (_req: Request, res: Response) => {
    try {
      db.clearGraph()
      res.json({ data: { success: true } })
    } catch (err) {
      console.error('Failed to clear graph:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to clear graph',
        },
      })
    }
  })

  /**
   * GET /api/graph/errors
   * 获取所有解析错误
   */
  router.get('/errors', (_req: Request, res: Response) => {
    try {
      const errors = db.getAllErrors()
      res.json({
        data: errors,
        meta: { count: errors.length },
      })
    } catch (err) {
      console.error('Failed to get errors:', err)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load errors',
        },
      })
    }
  })

  return router
}
