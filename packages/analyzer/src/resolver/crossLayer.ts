/**
 * 跨层连线器
 *
 * 连接前端调用 → 后端路由 → DB 操作的完整链路。
 * 处理路径变体匹配（/api/booking vs booking.create）。
 *
 * 遵循"降级而非崩溃"原则。
 */

import type { OmniGraph, OmniNode, OmniEdge } from '@omnivis/shared'
import { createEdgeId } from '@omnivis/shared'

// ============================================================
// 类型定义
// ============================================================

export interface CrossLayerResult {
  edges: OmniEdge[]
  stats: {
    callsApiEdges: number
    handlesEdges: number
    callsServiceEdges: number
    queriesDbEdges: number
  }
}

// ============================================================
// 跨层连线器
// ============================================================

export class CrossLayerLinker {
  /**
   * 执行跨层连线
   */
  link(graph: OmniGraph): CrossLayerResult {
    const edges: OmniEdge[] = []

    // 1. 前端 API 调用 → 后端路由
    const callsApiEdges = this.linkCallsApi(graph)
    edges.push(...callsApiEdges)

    // 2. 后端路由 → handler（暂时跳过，需要更复杂的分析）
    // const handlesEdges = this.linkHandles(graph)

    // 3. handler → service（暂时跳过）
    // const callsServiceEdges = this.linkCallsService(graph)

    // 4. service → DB model（暂时跳过）
    // const queriesDbEdges = this.linkQueriesDb(graph)

    return {
      edges,
      stats: {
        callsApiEdges: callsApiEdges.length,
        handlesEdges: 0,
        callsServiceEdges: 0,
        queriesDbEdges: 0,
      },
    }
  }

  /**
   * 连接前端 API 调用 → 后端路由
   */
  private linkCallsApi(graph: OmniGraph): OmniEdge[] {
    const edges: OmniEdge[] = []

    // 获取所有 calls_api 边
    const existingCallEdges = graph.edges.filter(e => e.type === 'calls_api')

    // 获取所有后端路由节点
    const apiRoutes = graph.nodes.filter(n =>
      n.type === 'api_route' || n.type === 'trpc_procedure'
    )

    // 尝试匹配
    for (const callEdge of existingCallEdges) {
      const targetNode = graph.nodes.find(n => n.id === callEdge.target)

      // 如果 target 已经是有效节点，跳过
      if (targetNode) {
        continue
      }

      // 尝试从 metadata 中提取 URL 进行匹配
      const metadata = callEdge.metadata as any
      const callType = metadata.callType

      if (callType === 'trpc_hook') {
        // tRPC hook：匹配 procedure 名称
        const procedureName = metadata.url // 格式：router.procedure
        const matchedProcedure = this.matchTrpcProcedure(procedureName, apiRoutes)

        if (matchedProcedure) {
          const newEdge: OmniEdge = {
            id: createEdgeId(callEdge.source, 'calls_api', matchedProcedure.id),
            source: callEdge.source,
            target: matchedProcedure.id,
            type: 'calls_api',
            confidence: 'certain',
            metadata: {
              ...metadata,
              matchedFrom: callEdge.id,
            },
          }
          edges.push(newEdge)
        }
      } else if (callType === 'fetch' || callType === 'axios') {
        // fetch/axios：匹配 URL 路径
        const url = metadata.url
        const matchedRoute = this.matchApiRoute(url, apiRoutes)

        if (matchedRoute) {
          const newEdge: OmniEdge = {
            id: createEdgeId(callEdge.source, 'calls_api', matchedRoute.id),
            source: callEdge.source,
            target: matchedRoute.id,
            type: 'calls_api',
            confidence: 'inferred',
            metadata: {
              ...metadata,
              matchedFrom: callEdge.id,
            },
          }
          edges.push(newEdge)
        }
      }
    }

    return edges
  }

  /**
   * 匹配 tRPC procedure
   * @param procedureName - 格式：router.procedure
   * @param procedures - 所有 procedure 节点
   */
  private matchTrpcProcedure(
    procedureName: string,
    procedures: OmniNode[]
  ): OmniNode | null {
    // 精确匹配
    const exactMatch = procedures.find(p => p.name === procedureName)
    if (exactMatch) return exactMatch

    // 尝试模糊匹配
    const [router, proc] = procedureName.split('.')
    if (!router || !proc) return null

    // 查找匹配的 procedure
    const fuzzyMatch = procedures.find(p => {
      const meta = p.metadata as any
      return meta.routerName === router && meta.procedureName === proc
    })

    return fuzzyMatch || null
  }

  /**
   * 匹配 API Route
   * @param url - 调用的 URL（如 /api/booking）
   * @param routes - 所有路由节点
   */
  private matchApiRoute(
    url: string,
    routes: OmniNode[]
  ): OmniNode | null {
    // 规范化 URL
    const normalizedUrl = this.normalizeUrl(url)

    // 精确匹配
    const exactMatch = routes.find(r => {
      const route = (r.metadata as any).route
      return this.normalizeUrl(route) === normalizedUrl
    })
    if (exactMatch) return exactMatch

    // 去掉 /api/ 前缀匹配
    const withoutApi = normalizedUrl.replace(/^\/api/, '')
    const withoutApiMatch = routes.find(r => {
      const route = (r.metadata as any).route
      return this.normalizeUrl(route) === withoutApi
    })
    if (withoutApiMatch) return withoutApiMatch

    // 模糊匹配（包含关系）
    const fuzzyMatch = routes.find(r => {
      const route = this.normalizeUrl((r.metadata as any).route)
      return normalizedUrl.includes(route) || route.includes(normalizedUrl)
    })

    return fuzzyMatch || null
  }

  /**
   * 规范化 URL
   */
  private normalizeUrl(url: string): string {
    // 移除查询参数
    let normalized = url.split('?')[0]

    // 移除尾部斜杠
    normalized = normalized.replace(/\/$/, '')

    // 确保以斜杠开头
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized
    }

    return normalized
  }
}
