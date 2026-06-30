/**
 * 图数据 API 路由
 *
 * 提供图数据的 CRUD 操作。
 * 遵循 REST API 格式规范。
 */

import { Router, Request, Response, RequestHandler } from 'express'
import type { OmniDatabase } from '@codeomnivis/analyzer'
import { DataFlowTracer } from '@codeomnivis/analyzer'
import type { NodeType, EdgeType } from '@codeomnivis/shared'
import { isEdgeType, isNodeType, sanitizeGraph } from '@codeomnivis/shared'

// 合法的节点类型和边类型
const VALID_NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  'page', 'component', 'api_route', 'trpc_procedure', 'express_route',
  'handler', 'service', 'db_model', 'module',
  'tsrpc_service', 'tsrpc_api', 'tsrpc_msg',
  'kotlin_class', 'kotlin_interface', 'kotlin_object', 'kotlin_function', 'kotlin_route',
])

const VALID_EDGE_TYPES: ReadonlySet<string> = new Set<EdgeType>([
  'renders', 'navigates_to', 'calls_api', 'handles', 'calls_service',
  'queries_db', 'db_relation', 'imports', 'contains', 'data_flows_to',
  'sends_msg', 'listens_msg',
  'kotlin_inherits', 'kotlin_implements', 'kotlin_uses',
])

// ============================================================
// 路由创建
// ============================================================

export function createGraphRouter(db: OmniDatabase, mutatingGuard?: RequestHandler): Router {
  const router = Router()
  // S-07:非 loopback 绑定时,DELETE 等 mutating 操作需通过鉴权守卫。
  const guard: RequestHandler = mutatingGuard ?? ((_req, _res, next) => next())

  /**
   * GET /api/graph
   * 获取完整的图数据
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const rawGraph = db.loadGraph()
      const { graph, stats: sanitizeStats } = sanitizeGraph(rawGraph)
      const stats = db.getStats()

      res.json({
        data: graph,
        meta: {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          nodesByType: stats.nodeTypeCounts,
          edgesByType: stats.edgeTypeCounts,
          sanitize: sanitizeStats,
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
        if (!isNodeType(type)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_TYPE',
              message: `Invalid node type: ${type}. Valid types: ${[...VALID_NODE_TYPES].join(', ')}`,
            },
          })
        }
          nodes = db.getNodesByType(type)
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
        if (!isEdgeType(type)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_TYPE',
              message: `Invalid edge type: ${type}. Valid types: ${[...VALID_EDGE_TYPES].join(', ')}`,
            },
          })
        }
          edges = db.getEdgesByType(type)
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
   * 清空图数据（需要 X-Confirm: true header）
   */
  router.delete('/', guard, (req: Request, res: Response) => {
    try {
      // 要求确认 header，防止误操作
      if (req.headers['x-confirm'] !== 'true') {
        return res.status(400).json({
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: 'This operation requires X-Confirm: true header',
          },
        })
      }

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

  /**
   * GET /api/graph/trace?node=<nodeId>
   * 从指定节点出发,双向(上游+下游)追踪全链路,返回有序站点序列。
   */
  router.get('/trace', (req: Request, res: Response) => {
    try {
      const nodeId = typeof req.query.node === 'string' ? req.query.node : undefined
      if (!nodeId) {
        return res.status(400).json({
          error: { code: 'MISSING_PARAM', message: 'Query param "node" is required' },
        })
      }
      const graph = db.loadGraph()
      const exists = graph.nodes.some(n => n.id === nodeId)
      if (!exists) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Node not found: ${nodeId}` },
        })
      }
      const tracer = new DataFlowTracer(graph)
      const result = tracer.traceFromNode(nodeId)
      res.json({ data: result, meta: { totalSteps: result.totalSteps } })
    } catch (err) {
      console.error('Failed to trace from node:', err)
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to trace from node' },
      })
    }
  })

  /**
   * GET /api/graph/dataflow
   * 追踪数据流：Model → API → Component
   */
  router.get('/dataflow', (req: Request, res: Response) => {
    try {
      const graph = db.loadGraph()
      const tracer = new DataFlowTracer(graph)

      const model = typeof req.query.model === 'string' ? req.query.model : undefined

      if (model) {
        // 追踪指定 model
        const modelNode = graph.nodes.find(
          n => n.type === 'db_model' && (n.name === model || n.id.includes(model))
        )
        if (!modelNode) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: `Model not found: ${model}` },
          })
        }

        const path = tracer.traceModelFlow(modelNode)
        res.json({
          data: {
            modelId: modelNode.id,
            modelName: modelNode.name,
            paths: [path],
            totalRoutes: path.apiNodes.length,
            totalComponents: path.componentNodes.length,
          },
        })
      } else {
        // 返回所有 model 的数据流概览
        const results = tracer.traceAllModels()
        res.json({
          data: results,
          meta: { count: results.length },
        })
      }
    } catch (err) {
      console.error('Failed to trace dataflow:', err)
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to trace dataflow' },
      })
    }
  })

  return router
}
