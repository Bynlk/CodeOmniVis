/**
 * 一致性检测器
 *
 * 检测图中的问题：
 * - 死链 API 调用
 * - 未使用路由
 * - HTTP method 不匹配
 * - tRPC procedure 不存在
 */

import type { OmniGraph, OmniNode, Issue, IssueType, IssueSeverity, ConsistencyReport, CallsApiMetadata, ApiRouteMetadata } from '@codeomnivis/shared'

// ============================================================
// 一致性检测器
// ============================================================

export class ConsistencyChecker {
  /**
   * 执行一致性检测
   */
  check(graph: OmniGraph): ConsistencyReport {
    const issues: Issue[] = []

    // 预构建索引，避免 O(n) 查找
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
    const incomingEdges = new Map<string, number>()
    const outgoingEdges = new Map<string, number>()

    for (const edge of graph.edges) {
      incomingEdges.set(edge.target, (incomingEdges.get(edge.target) ?? 0) + 1)
      outgoingEdges.set(edge.source, (outgoingEdges.get(edge.source) ?? 0) + 1)
    }

    // 1. 检测死链 API 调用
    issues.push(...this.checkDeadApiCalls(graph, nodeMap))

    // 2. 检测未使用路由
    issues.push(...this.checkUnusedRoutes(graph, incomingEdges))

    // 3. 检测孤立节点
    issues.push(...this.checkOrphanNodes(graph, incomingEdges, outgoingEdges))

    // 4. 检测 HTTP method 不匹配
    issues.push(...this.checkMethodMismatch(graph, nodeMap))

    // 5. 检测 tRPC procedure 不存在
    issues.push(...this.checkMissingProcedures(graph, nodeMap))

    // 6. 检测死代码
    issues.push(...this.detectDeadCode(graph))

    // 7. 检测循环依赖
    issues.push(...this.detectCircularDependencies(graph))

    // 计算统计
    const summary = {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    }

    return { issues, summary }
  }

  /**
   * 检测死链 API 调用
   * calls_api 边指向不存在的节点
   */
  private checkDeadApiCalls(graph: OmniGraph, nodeMap: Map<string, OmniNode>): Issue[] {
    const issues: Issue[] = []

    for (const edge of graph.edges) {
      if (edge.type !== 'calls_api') continue

      // 检查 target 是否存在
      if (!nodeMap.has(edge.target)) {
        issues.push({
          id: `dead-link-${edge.id}`,
          type: 'dead_api_call',
          severity: 'warning',
          description: `API call points to non-existent node: ${edge.target}`,
          locations: [{
            file: edge.source.split(':')[1] || 'unknown',
            line: 0,
          }],
          relatedNodeIds: [edge.source, edge.target],
          relatedEdgeIds: [edge.id],
        })
      }
    }

    return issues
  }

  /**
   * 检测未使用路由
   * api_route 或 trpc_procedure 没有任何入边
   */
  private checkUnusedRoutes(graph: OmniGraph, incomingEdges: Map<string, number>): Issue[] {
    const issues: Issue[] = []

    const routeNodes = graph.nodes.filter(n =>
      n.type === 'api_route' || n.type === 'trpc_procedure'
    )

    for (const route of routeNodes) {
      if (!incomingEdges.has(route.id)) {
        issues.push({
          id: `unused-route-${route.id}`,
          type: 'unused_route',
          severity: 'info',
          description: `Route appears to be unused: ${route.name}`,
          locations: [{
            file: route.filePath,
            line: route.line,
          }],
          relatedNodeIds: [route.id],
          relatedEdgeIds: [],
        })
      }
    }

    return issues
  }

  /**
   * 检测孤立节点
   * 没有任何边连接的节点
   */
  private checkOrphanNodes(graph: OmniGraph, incomingEdges: Map<string, number>, outgoingEdges: Map<string, number>): Issue[] {
    const issues: Issue[] = []

    for (const node of graph.nodes) {
      const hasIncoming = incomingEdges.has(node.id)
      const hasOutgoing = outgoingEdges.has(node.id)

      if (!hasIncoming && !hasOutgoing && node.type !== 'module') {
        issues.push({
          id: `orphan-${node.id}`,
          type: 'unused_route',
          severity: 'info',
          description: `Node has no connections: ${node.name}`,
          locations: [{
            file: node.filePath,
            line: node.line,
          }],
          relatedNodeIds: [node.id],
          relatedEdgeIds: [],
        })
      }
    }

    return issues
  }

  /**
   * 检测 HTTP method 不匹配
   * calls_api 边的 method 与目标 api_route 的 method 不匹配
   */
  private checkMethodMismatch(graph: OmniGraph, nodeMap: Map<string, OmniNode>): Issue[] {
    const issues: Issue[] = []

    for (const edge of graph.edges) {
      if (edge.type !== 'calls_api') continue

      const sourceNode = nodeMap.get(edge.source)
      const targetNode = nodeMap.get(edge.target)

      if (!sourceNode || !targetNode) continue
      if (targetNode.type !== 'api_route') continue

      const edgeMetadata = edge.metadata as CallsApiMetadata
      const targetMetadata = targetNode.metadata as ApiRouteMetadata

      if (!edgeMetadata?.method || !targetMetadata?.method) continue

      const callMethod = edgeMetadata.method.toUpperCase()
      const routeMethods = targetMetadata.method.split(',').map((m: string) => m.trim().toUpperCase())

      // 检查调用的 method 是否在路由支持的 method 列表中
      if (!routeMethods.includes(callMethod) && !routeMethods.includes('ALL')) {
        issues.push({
          id: `method-mismatch-${edge.id}`,
          type: 'method_mismatch',
          severity: 'warning',
          description: `HTTP method mismatch: ${sourceNode.name} calls ${targetNode.name} with ${callMethod}, but route only supports ${routeMethods.join(',')}`,
          locations: [{
            file: sourceNode.filePath,
            line: sourceNode.line,
          }],
          relatedNodeIds: [edge.source, edge.target],
          relatedEdgeIds: [edge.id],
        })
      }
    }

    return issues
  }

  /**
   * 检测 tRPC procedure 不存在
   * calls_api 边指向的 tRPC procedure 在图中不存在
   */
  private checkMissingProcedures(graph: OmniGraph, nodeMap: Map<string, OmniNode>): Issue[] {
    const issues: Issue[] = []

    const procedureNames = new Set(
      graph.nodes
        .filter(n => n.type === 'trpc_procedure')
        .map(n => n.name)
    )

    for (const edge of graph.edges) {
      if (edge.type !== 'calls_api') continue

      const targetNode = nodeMap.get(edge.target)
      if (targetNode) continue // target 存在，跳过

      const edgeMetadata = edge.metadata as CallsApiMetadata
      if (edgeMetadata?.callType !== 'trpc_hook') continue

      const procedureName = (edgeMetadata as unknown as Record<string, unknown>).url as string | undefined // 格式：router.procedure
      if (!procedureName) continue

      // 检查 procedure 是否存在
      const [router, proc] = procedureName.split('.')
      const exists = procedureNames.has(proc) || procedureNames.has(procedureName)

      if (!exists) {
        const sourceNode = nodeMap.get(edge.source)
        issues.push({
          id: `missing-proc-${edge.id}`,
          type: 'missing_procedure',
          severity: 'warning',
          description: `tRPC procedure not found: ${procedureName} (called from ${sourceNode?.name || 'unknown'})`,
          locations: [{
            file: sourceNode?.filePath || 'unknown',
            line: sourceNode?.line || 0,
          }],
          relatedNodeIds: [edge.source],
          relatedEdgeIds: [edge.id],
        })
      }
    }

    return issues
  }

  // ============================================================
  // Task 3.2：死代码检测
  // ============================================================

  /**
   * 检测死代码
   * - dead_route: api_route/trpc_procedure/express_route 没有 calls_api 入边
   * - dead_component: component 没有 renders 入边
   * - dead_service: service 没有 calls_service 入边
   */
  detectDeadCode(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []

    // 预构建入边索引
    const incomingByType = new Map<string, Map<string, string[]>>() // edgeType → targetId → sourceIds[]

    for (const edge of graph.edges) {
      if (!incomingByType.has(edge.type)) {
        incomingByType.set(edge.type, new Map())
      }
      const targets = incomingByType.get(edge.type)!
      if (!targets.has(edge.target)) {
        targets.set(edge.target, [])
      }
      targets.get(edge.target)!.push(edge.source)
    }

    for (const node of graph.nodes) {
      // dead_route: 路由没有 calls_api 入边
      if (node.type === 'api_route' || node.type === 'trpc_procedure' || node.type === 'express_route') {
        const callers = incomingByType.get('calls_api')?.get(node.id) ?? []
        if (callers.length === 0) {
          issues.push({
            id: `dead-route-${node.id}`,
            type: 'dead_route',
            severity: 'warning',
            description: `Route has no callers: ${node.name}`,
            locations: [{ file: node.filePath, line: node.line }],
            relatedNodeIds: [node.id],
            relatedEdgeIds: [],
          })
        }
      }

      // dead_component: 组件没有 renders 入边
      if (node.type === 'component') {
        const renderers = incomingByType.get('renders')?.get(node.id) ?? []
        if (renderers.length === 0) {
          issues.push({
            id: `dead-component-${node.id}`,
            type: 'dead_component',
            severity: 'info',
            description: `Component is not rendered by any parent: ${node.name}`,
            locations: [{ file: node.filePath, line: node.line }],
            relatedNodeIds: [node.id],
            relatedEdgeIds: [],
          })
        }
      }

      // dead_service: service 没有 calls_service 入边
      if (node.type === 'service') {
        const callers = incomingByType.get('calls_service')?.get(node.id) ?? []
        if (callers.length === 0) {
          issues.push({
            id: `dead-service-${node.id}`,
            type: 'dead_service',
            severity: 'info',
            description: `Service has no callers: ${node.name}`,
            locations: [{ file: node.filePath, line: node.line }],
            relatedNodeIds: [node.id],
            relatedEdgeIds: [],
          })
        }
      }
    }

    return issues
  }

  // ============================================================
  // Task 3.3：循环依赖检测（Tarjan SCC）
  // ============================================================

  /**
   * 检测循环依赖
   * 使用 Tarjan 强连通分量算法在 imports 边上检测循环
   */
  detectCircularDependencies(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []

    // 构建 imports 边的邻接表
    const adj = new Map<string, string[]>()
    for (const edge of graph.edges) {
      if (edge.type !== 'imports') continue
      if (!adj.has(edge.source)) adj.set(edge.source, [])
      adj.get(edge.source)!.push(edge.target)
    }

    if (adj.size === 0) return issues

    // Tarjan 算法
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
    const index = new Map<string, number>()
    const lowlink = new Map<string, number>()
    const onStack = new Set<string>()
    const stack: string[] = []
    let idx = 0
    const sccs: string[][] = []

    const strongConnect = (v: string) => {
      index.set(v, idx)
      lowlink.set(v, idx)
      idx++
      stack.push(v)
      onStack.add(v)

      const neighbors = adj.get(v) ?? []
      for (const w of neighbors) {
        if (!index.has(w)) {
          strongConnect(w)
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
        }
      }

      // 如果 v 是根节点，弹出整个 SCC
      if (lowlink.get(v) === index.get(v)) {
        const scc: string[] = []
        let w: string
        do {
          w = stack.pop()!
          onStack.delete(w)
          scc.push(w)
        } while (w !== v)

        if (scc.length > 1) {
          sccs.push(scc)
        }
      }
    }

    // 对所有节点运行 Tarjan
    for (const v of adj.keys()) {
      if (!index.has(v)) {
        strongConnect(v)
      }
    }

    // 生成 Issue
    for (const scc of sccs) {
      const nodeNames = scc.map(id => nodeMap.get(id)?.name ?? id)
      const cyclePath = nodeNames.join(' → ') + ' → ' + nodeNames[0]
      const locations = scc
        .map(id => nodeMap.get(id))
        .filter((n): n is OmniNode => n !== undefined)
        .map(n => ({ file: n.filePath, line: n.line }))

      issues.push({
        id: `circular-${scc.sort().join('-')}`,
        type: 'circular_dependency',
        severity: 'warning',
        description: `Circular dependency detected: ${cyclePath}`,
        locations,
        relatedNodeIds: scc,
        relatedEdgeIds: [],
      })
    }

    return issues
  }
}
