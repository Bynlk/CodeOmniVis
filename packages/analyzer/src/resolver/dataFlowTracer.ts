/**
 * 数据流追踪器
 *
 * 追踪一个类型从数据库定义，经过 API 层，传播到前端组件的完整路径。
 * 链路：DB Model → Service/Handler → API Route → Component
 *
 * 遵循"降级而非崩溃"原则。
 */

import type { OmniEdge, OmniGraph, OmniNode, EdgeType, TraceResult, TraceStep } from '@codeomnivis/shared'
import { createEdgeId, traceLayerForNodeType } from '@codeomnivis/shared'

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

/**
 * 单次 traceFromNode 的最大站点数(含 root)。
 * 上游与下游共享该预算,确保 totalSteps 不超过此上限,并阻断环导致的无限遍历。
 */
const MAX_TRACE_STEPS = 64

/**
 * findParentApiRoutes 沿 calls_service 入边回溯的最大深度。
 * 配合 visited 集合阻断 calls_service 环导致的无限递归(BOUND-05)。
 */
const MAX_PARENT_ROUTE_DEPTH = 64

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
      const routes = this.findParentApiRoutes(caller, new Set<string>(), 0)
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
  private findParentApiRoutes(node: OmniNode, visited: Set<string>, depth: number): OmniNode[] {
    const routes: OmniNode[] = []

    // 环防护(BOUND-05):已访问节点直接返回,避免 calls_service 环无限递归。
    if (visited.has(node.id)) return routes
    visited.add(node.id)

    // 深度硬上限:即使图无环,也阻断超长 calls_service 链的栈增长。
    if (depth >= MAX_PARENT_ROUTE_DEPTH) return routes

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
            routes.push(...this.findParentApiRoutes(source, visited, depth + 1))
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

  // ============================================================
  // 全链路追踪(双向)
  // ============================================================

  /**
   * 从任意节点出发,沿链路边双向遍历,产出有序站点序列。
   * 上游:沿入边回溯(朝前端);下游:沿出边前进(朝数据)。
   * 每一步选取"主路径"边(链路类型且未访问),得到一条线性链路。
   */
  traceFromNode(rootId: string): TraceResult {
    const root = this.nodeMap.get(rootId)
    if (!root) {
      return { rootId, steps: [], totalSteps: 0 }
    }

    const visited = new Set<string>([rootId])

    // 整条链路(上游 + 下游)共享一个步数预算,避免环导致死循环,
    // 也保证 totalSteps 不超过 MAX_TRACE_STEPS(含 root)。
    let budget = MAX_TRACE_STEPS - 1

    // 上游链(入边方向),收集后反转 → 从最上游到 root 的前一站
    const upstream: Array<{ node: OmniNode; edge: OmniEdge }> = []
    {
      let current = root
      while (budget > 0) {
        const next = this.pickLinkEdge(this.incomingEdges.get(current.id), visited, 'source')
        if (!next) break
        upstream.push({ node: next.node, edge: next.edge })
        visited.add(next.node.id)
        current = next.node
        budget--
      }
    }
    upstream.reverse()

    // 下游链(出边方向),消耗同一预算
    const downstream: Array<{ node: OmniNode; edge: OmniEdge }> = []
    {
      let current = root
      while (budget > 0) {
        const next = this.pickLinkEdge(this.outgoingEdges.get(current.id), visited, 'target')
        if (!next) break
        downstream.push({ node: next.node, edge: next.edge })
        visited.add(next.node.id)
        current = next.node
        budget--
      }
    }

    // 组装有序站点:upstream(每站的边连向下一站) → root(无 prev 边) → downstream
    const steps: TraceStep[] = []
    let index = 1

    for (let i = 0; i < upstream.length; i++) {
      const { node } = upstream[i]
      // 这一站到下一站的连接边:上游 i 的边即连向 upstream[i+1] 或 root
      const edgeFromPrev: EdgeType | null = i === 0 ? null : upstream[i - 1].edge.type
      steps.push(this.toStep(index++, node, edgeFromPrev))
    }

    // root 的 prev 边:最后一个 upstream 的边连向 root
    const rootPrevEdge: EdgeType | null =
      upstream.length > 0 ? upstream[upstream.length - 1].edge.type : null
    steps.push(this.toStep(index++, root, rootPrevEdge))

    for (let i = 0; i < downstream.length; i++) {
      const { node, edge } = downstream[i]
      steps.push(this.toStep(index++, node, edge.type))
    }

    return { rootId, steps, totalSteps: steps.length }
  }

  /** 链路遍历采用的边类型(结构 + 数据流)。 */
  private static readonly LINK_EDGE_TYPES: ReadonlySet<EdgeType> = new Set<EdgeType>([
    'renders', 'navigates_to', 'calls_api', 'handles', 'calls_service',
    'queries_db', 'data_flows_to', 'sends_msg', 'listens_msg',
  ])

  /** 从候选边里挑一条链路边,返回相连节点与边。dir 指定取边的哪一端为下一站。 */
  private pickLinkEdge(
    edges: OmniEdge[] | undefined,
    visited: Set<string>,
    dir: 'source' | 'target',
  ): { node: OmniNode; edge: OmniEdge } | null {
    if (!edges) return null
    for (const edge of edges) {
      if (!DataFlowTracer.LINK_EDGE_TYPES.has(edge.type)) continue
      const nextId = dir === 'source' ? edge.source : edge.target
      if (visited.has(nextId)) continue
      const node = this.nodeMap.get(nextId)
      if (node) return { node, edge }
    }
    return null
  }

  /** 节点 + 连接边 → TraceStep(含静态说明)。 */
  private toStep(index: number, node: OmniNode, edgeFromPrev: EdgeType | null): TraceStep {
    return {
      index,
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      layer: traceLayerForNodeType(node.type),
      filePath: node.filePath,
      line: node.line,
      edgeFromPrev,
      explanation: explainStep(node, edgeFromPrev),
    }
  }
}


// ============================================================
// 静态节点说明(AI-fallback 之前的"静态优先"层)
// ============================================================

const EDGE_VERB: Record<EdgeType, string> = {
  renders: '渲染',
  navigates_to: '导航至',
  calls_api: '调用接口',
  handles: '处理',
  calls_service: '调用服务',
  queries_db: '查询数据',
  db_relation: '关联',
  imports: '导入',
  contains: '聚合',
  data_flows_to: '数据流向',
  sends_msg: '发送消息',
  listens_msg: '监听消息',
  kotlin_inherits: '继承',
  kotlin_implements: '实现',
  kotlin_uses: '依赖',
  tests: '包含测试',
  covers: '覆盖',
  uses_fixture: '使用夹具',
}

function nodeRoleText(node: OmniNode): string {
  switch (node.type) {
    case 'page':
      return `页面 ${node.name},承载路由 ${node.metadata.route}`
    case 'component':
      return `React 组件 ${node.name}`
    case 'api_route':
      return `API 路由 ${node.metadata.method} ${node.metadata.route}`
    case 'trpc_procedure':
      return `tRPC ${node.metadata.procedureType} 过程 ${node.name}`
    case 'tsrpc_service':
      return `TSRPC service ${node.metadata.servicePath}`
    case 'tsrpc_api':
      return `TSRPC API ${node.metadata.apiPath}`
    case 'tsrpc_msg':
      return `TSRPC 消息 ${node.metadata.msgName}`
    case 'express_route':
      return `Express 路由 ${node.metadata.method} ${node.metadata.route}`
    case 'handler':
      return `请求处理函数 ${node.name}`
    case 'service':
      return `业务服务 ${node.name}`
    case 'db_model':
      return `数据模型 ${node.name}(表 ${node.metadata.tableName},${node.metadata.fieldCount} 个字段)`
    case 'module':
      return `聚合模块 ${node.name}`
    case 'kotlin_class':
      return `Kotlin 类 ${node.name}`
    case 'kotlin_interface':
      return `Kotlin 接口 ${node.name}`
    case 'kotlin_object':
      return `Kotlin object ${node.name}`
    case 'kotlin_function':
      return `Kotlin 函数 ${node.name}`
    case 'kotlin_route':
      return `Kotlin 路由 ${node.metadata.method} ${node.metadata.path}`
    case 'test_suite':
      return `测试套件 ${node.name}`
    case 'test_case':
      return `测试用例 ${node.name}`
    case 'test_fixture':
      return `测试夹具 ${node.name}`
  }
}

/** 生成站点的静态说明:由上一站如何抵达本站 + 本站角色。 */
export function explainStep(node: OmniNode, edgeFromPrev: EdgeType | null): string {
  const role = nodeRoleText(node)
  if (edgeFromPrev === null) {
    return `链路起点:${role}。`
  }
  return `经「${EDGE_VERB[edgeFromPrev]}」抵达${role}。`
}
