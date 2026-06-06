/**
 * 一致性检测器
 *
 * 检测图中的问题：
 * - 死链 API 调用
 * - 未使用路由
 * - HTTP method 不匹配
 * - tRPC procedure 不存在
 */

import type { OmniGraph, OmniNode, Issue, IssueType, IssueSeverity } from '@omnivis/shared'

// ============================================================
// 一致性检测结果
// ============================================================

export interface ConsistencyReport {
  issues: Issue[]
  stats: {
    totalIssues: number
    criticalCount: number
    warningCount: number
    infoCount: number
  }
}

// ============================================================
// 一致性检测器
// ============================================================

export class ConsistencyChecker {
  /**
   * 执行一致性检测
   */
  check(graph: OmniGraph): ConsistencyReport {
    const issues: Issue[] = []

    // 1. 检测死链 API 调用
    issues.push(...this.checkDeadApiCalls(graph))

    // 2. 检测未使用路由
    issues.push(...this.checkUnusedRoutes(graph))

    // 3. 检测孤立节点
    issues.push(...this.checkOrphanNodes(graph))

    // 4. 检测 HTTP method 不匹配
    issues.push(...this.checkMethodMismatch(graph))

    // 5. 检测 tRPC procedure 不存在
    issues.push(...this.checkMissingProcedures(graph))

    // 计算统计
    const stats = {
      totalIssues: issues.length,
      criticalCount: issues.filter(i => i.severity === 'critical').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      infoCount: issues.filter(i => i.severity === 'info').length,
    }

    return { issues, stats }
  }

  /**
   * 检测死链 API 调用
   * calls_api 边指向不存在的节点
   */
  private checkDeadApiCalls(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []
    const nodeIds = new Set(graph.nodes.map(n => n.id))

    for (const edge of graph.edges) {
      if (edge.type !== 'calls_api') continue

      // 检查 target 是否存在
      if (!nodeIds.has(edge.target)) {
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
  private checkUnusedRoutes(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []

    const routeNodes = graph.nodes.filter(n =>
      n.type === 'api_route' || n.type === 'trpc_procedure'
    )

    for (const route of routeNodes) {
      const hasIncoming = graph.edges.some(e => e.target === route.id)

      if (!hasIncoming) {
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
  private checkOrphanNodes(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []

    for (const node of graph.nodes) {
      const hasEdge = graph.edges.some(
        e => e.source === node.id || e.target === node.id
      )

      if (!hasEdge && node.type !== 'module') {
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
  private checkMethodMismatch(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []

    for (const edge of graph.edges) {
      if (edge.type !== 'calls_api') continue

      const sourceNode = graph.nodes.find(n => n.id === edge.source)
      const targetNode = graph.nodes.find(n => n.id === edge.target)

      if (!sourceNode || !targetNode) continue
      if (targetNode.type !== 'api_route') continue

      const edgeMetadata = edge.metadata as any
      const targetMetadata = targetNode.metadata as any

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
  private checkMissingProcedures(graph: OmniGraph): Issue[] {
    const issues: Issue[] = []

    const procedureNames = new Set(
      graph.nodes
        .filter(n => n.type === 'trpc_procedure')
        .map(n => n.name)
    )

    for (const edge of graph.edges) {
      if (edge.type !== 'calls_api') continue

      const targetNode = graph.nodes.find(n => n.id === edge.target)
      if (targetNode) continue // target 存在，跳过

      const edgeMetadata = edge.metadata as any
      if (edgeMetadata?.callType !== 'trpc_hook') continue

      const procedureName = edgeMetadata.url // 格式：router.procedure
      if (!procedureName) continue

      // 检查 procedure 是否存在
      const [router, proc] = procedureName.split('.')
      const exists = procedureNames.has(proc) || procedureNames.has(procedureName)

      if (!exists) {
        const sourceNode = graph.nodes.find(n => n.id === edge.source)
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
}
