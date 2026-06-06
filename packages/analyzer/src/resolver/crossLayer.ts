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

    // 获取所有组件节点（用于匹配 source）
    const components = graph.nodes.filter(n => n.type === 'component')

    // 尝试匹配
    for (const callEdge of existingCallEdges) {
      const targetNode = graph.nodes.find(n => n.id === callEdge.target)

      // 如果 target 已经是有效节点，跳过
      if (targetNode) {
        continue
      }

      // 尝试修复 source：从文件路径匹配实际组件
      let sourceId = callEdge.source
      const sourceParts = callEdge.source.split(':')
      if (sourceParts.length >= 2 && sourceParts[2] === 'unknown') {
        const filePath = sourceParts[1]
        const matchedComponent = components.find(c => c.filePath === filePath)
        if (matchedComponent) {
          sourceId = matchedComponent.id
        }
      }

      // 从 target ID 中提取 URL
      // target ID 格式：api_route:unknown:/api/xxx 或 trpc_procedure:unknown:router.procedure
      const targetParts = callEdge.target.split(':')
      const url = targetParts.slice(2).join(':') // 处理 URL 中可能包含 : 的情况

      const metadata = callEdge.metadata as any
      const callType = metadata.callType

      if (callType === 'trpc_hook') {
        // tRPC hook：匹配 procedure 名称
        const matchedProcedure = this.matchTrpcProcedure(url, apiRoutes)

        if (matchedProcedure) {
          const newEdge: OmniEdge = {
            id: createEdgeId(sourceId, 'calls_api', matchedProcedure.id),
            source: sourceId,
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
        const matchedRoute = this.matchApiRoute(url, apiRoutes)

        if (matchedRoute) {
          const newEdge: OmniEdge = {
            id: createEdgeId(sourceId, 'calls_api', matchedRoute.id),
            source: sourceId,
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

    // 处理基础路径前缀（如 /byresume/api/xxx → /api/xxx）
    const basePrefixMatch = normalizedUrl.match(/^\/[^/]+(\/api\/.+)$/)
    if (basePrefixMatch) {
      const withoutPrefix = basePrefixMatch[1]
      const prefixMatch = routes.find(r => {
        const route = (r.metadata as any).route
        return this.normalizeUrl(route) === withoutPrefix
      })
      if (prefixMatch) return prefixMatch
    }

    // 精确路径段匹配（最后一段路径匹配）
    const urlSegments = normalizedUrl.split('/').filter(Boolean)
    const lastSegment = urlSegments[urlSegments.length - 1]
    if (lastSegment) {
      const segmentMatch = routes.find(r => {
        const route = (r.metadata as any).route
        const routeSegments = this.normalizeUrl(route).split('/').filter(Boolean)
        const routeLastSegment = routeSegments[routeSegments.length - 1]
        return routeLastSegment === lastSegment
      })
      if (segmentMatch) return segmentMatch
    }

    return null
  }

  /**
   * 规范化 URL
   */
  private normalizeUrl(url: string): string {
    if (!url) return '/'

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
