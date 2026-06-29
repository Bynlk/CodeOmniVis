/**
 * 数据流追踪器
 *
 * 追踪一个类型从数据库定义，经过 API 层，传播到前端组件的完整路径。
 * 链路：DB Model → Service/Handler → API Route → Component
 *
 * 遵循"降级而非崩溃"原则。
 */

import type { OmniEdge, OmniGraph, OmniNode } from '@codeomnivis/shared'
import { createEdgeId } from '@codeomnivis/shared'

function getOrCreateEdges(map: Map<string, OmniEdge[]>, key: string): OmniEdge[] {
  const existing = map.get(key)
  if (existing) return existing

  const created: OmniEdge[] = []
  map.set(key, created)
  return created
}

// ============================================================
// 类型定义
// ============================================================

export interface DataFlowPath {
  modelNode: OmniNode
  apiNodes: OmniNode[]
  componentNodes: OmniNode[]
  edges: DataFlowEdge[]
}

export interface DataFlowEdge {
  from: string
  to: string
  typeName: string
  transferMethod: 'return_type' | 'prop_type' | 'hook_data' | 'prisma_result'
  file: string
  line: number
}

export interface DataFlowResult {
  modelId: string
  modelName: string
  paths: DataFlowPath[]
  totalRoutes: number
  totalComponents: number
}

// ============================================================
// DataFlowTracer
// ============================================================

export class DataFlowTracer {
  private graph: OmniGraph
  private nodeMap: Map<string, OmniNode>
  private incomingEdges: Map<string, OmniEdge[]>
  private outgoingEdges: Map<string, OmniEdge[]>

  constructor(graph: OmniGraph) {
    this.graph = graph
    this.nodeMap = new Map(graph.nodes.map(n => [n.id, n]))

    // 预构建边索引
    this.incomingEdges = new Map()
    this.outgoingEdges = new Map()
    for (const edge of graph.edges) {
      getOrCreateEdges(this.incomingEdges, edge.target).push(edge)
      getOrCreateEdges(this.outgoingEdges, edge.source).push(edge)
    }
  }

  /**
   * 追踪单个 Model 的数据流
   */
  traceModelFlow(modelNode: OmniNode): DataFlowPath {
    // Step 1: 找查询这个 model 的所有 handler/service（通过 queries_db 边反向）
    const queryCallers = this.findQueryCallers(modelNode)

    // Step 2: 从 caller 向上找 API 路由
    const apiNodes: OmniNode[] = []
    for (const caller of queryCallers) {
      const routes = this.findParentApiRoutes(caller)
      apiNodes.push(...routes)
    }

    // 去重
    const uniqueApiNodes = this.deduplicateNodes(apiNodes)

    // Step 3: 从 API 节点向前找使用这些数据的组件
    const componentNodes: OmniNode[] = []
    for (const apiNode of uniqueApiNodes) {
      const callers = this.findApiCallers(apiNode)
      componentNodes.push(...callers)
    }

    const uniqueComponents = this.deduplicateNodes(componentNodes)

    // 构建数据流边
    const edges: DataFlowEdge[] = []

    // Model → Service/Handler
    for (const caller of queryCallers) {
      edges.push({
        from: modelNode.id,
        to: caller.id,
        typeName: modelNode.name,
        transferMethod: 'prisma_result',
        file: caller.filePath,
        line: caller.line,
      })
    }

    // Service/Handler → API Route
    for (const apiNode of uniqueApiNodes) {
      // 找连接到这个 API 的 service/handler
      const handles = this.incomingEdges.get(apiNode.id)?.filter(e => e.type === 'handles') ?? []
      for (const handle of handles) {
        edges.push({
          from: handle.source,
          to: apiNode.id,
          typeName: modelNode.name,
          transferMethod: 'return_type',
          file: apiNode.filePath,
          line: apiNode.line,
        })
      }
    }

    // API Route → Component
    for (const apiNode of uniqueApiNodes) {
      const apiCallers = this.findApiCallers(apiNode)
      for (const comp of apiCallers) {
        edges.push({
          from: apiNode.id,
          to: comp.id,
          typeName: modelNode.name,
          transferMethod: 'hook_data',
          file: comp.filePath,
          line: comp.line,
        })
      }
    }

    return {
      modelNode,
      apiNodes: uniqueApiNodes,
      componentNodes: uniqueComponents,
      edges,
    }
  }

  /**
   * 追踪所有 Model 的数据流
   */
  traceAllModels(): DataFlowResult[] {
    const modelNodes = this.graph.nodes.filter(n => n.type === 'db_model')
    return modelNodes.map(model => {
      const path = this.traceModelFlow(model)
      return {
        modelId: model.id,
        modelName: model.name,
        paths: [path],
        totalRoutes: path.apiNodes.length,
        totalComponents: path.componentNodes.length,
      }
    })
  }

  /**
   * 将数据流路径转为 OmniEdge（存入数据库）
   */
  pathToEdges(path: DataFlowPath): OmniEdge[] {
    return path.edges.map(e => {
      const edgeId = createEdgeId(e.from, 'data_flows_to', `${e.to}:${e.typeName}`)
      const edge: OmniEdge = {
        id: edgeId,
        source: e.from,
        target: e.to,
        type: 'data_flows_to',
        confidence: 'inferred',
        metadata: {
          typeName: e.typeName,
          transferMethod: e.transferMethod,
        },
      }
      return edge
    })
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 找查询 model 的所有节点（queries_db 边的源节点）
   */
  private findQueryCallers(modelNode: OmniNode): OmniNode[] {
    const callers: OmniNode[] = []
    const inEdges = this.incomingEdges.get(modelNode.id) ?? []

    for (const edge of inEdges) {
      if (edge.type === 'queries_db') {
        const source = this.nodeMap.get(edge.source)
        if (source) callers.push(source)
      }
    }

    return callers
  }

  /**
   * 从 service/handler 向上找 API 路由（通过 handles 边）
   */
  private findParentApiRoutes(node: OmniNode): OmniNode[] {
    const routes: OmniNode[] = []

    // 如果自己就是 API 路由
    if (node.type === 'api_route' || node.type === 'trpc_procedure' || node.type === 'express_route') {
      routes.push(node)
      return routes
    }

    // 通过 handles 边向上找（API Route → Handler，所以要找 handles 边的 source）
    const inEdges = this.incomingEdges.get(node.id) ?? []
    for (const edge of inEdges) {
      if (edge.type === 'handles') {
        const source = this.nodeMap.get(edge.source)
        if (source && (source.type === 'api_route' || source.type === 'trpc_procedure' || source.type === 'express_route')) {
          routes.push(source)
        }
      }
    }

    // 通过 calls_service 边向上找（Handler → Service，所以要找 calls_service 边的 source）
    if (routes.length === 0) {
      for (const edge of inEdges) {
        if (edge.type === 'calls_service') {
          const source = this.nodeMap.get(edge.source)
          if (source) {
            routes.push(...this.findParentApiRoutes(source))
          }
        }
      }
    }

    return routes
  }

  /**
   * 找调用 API 的组件（calls_api 边的源节点）
   */
  private findApiCallers(apiNode: OmniNode): OmniNode[] {
    const callers: OmniNode[] = []
    const inEdges = this.incomingEdges.get(apiNode.id) ?? []

    for (const edge of inEdges) {
      if (edge.type === 'calls_api') {
        const source = this.nodeMap.get(edge.source)
        if (source && source.type === 'component') {
          callers.push(source)
        }
      }
    }

    return callers
  }

  /**
   * 节点去重
   */
  private deduplicateNodes(nodes: OmniNode[]): OmniNode[] {
    const seen = new Set<string>()
    return nodes.filter(n => {
      if (seen.has(n.id)) return false
      seen.add(n.id)
      return true
    })
  }
}
