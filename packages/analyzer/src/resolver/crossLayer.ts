/**
 * 跨层连线器
 *
 * 连接前端调用 → 后端路由 → DB 操作的完整链路。
 * 处理路径变体匹配（/api/booking vs booking.create）。
 *
 * 遵循"降级而非崩溃"原则。
 */

import type {
  CallsApiMetadata,
  EdgeType,
  EdgeTypeMetadataMap,
  OmniEdge,
  OmniGraph,
  OmniNode,
  TypedOmniEdge,
} from '@codeomnivis/shared'
import { createEdgeId, createTypedEdge, createTypedNode, isNodeOfType } from '@codeomnivis/shared'
import * as fs from 'fs'
import * as path from 'path'
import { SymbolResolver, type DbCall } from './symbolResolver'

// ============================================================
// 辅助函数
// ============================================================

function makeEdge<T extends EdgeType>(
  source: string,
  target: string,
  type: T,
  confidence: 'certain' | 'inferred',
  metadata: EdgeTypeMetadataMap[T]
): TypedOmniEdge<T> {
  return createTypedEdge({
    id: createEdgeId(source, type, target),
    source,
    target,
    type,
    confidence,
    metadata,
  })
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

interface ServiceImport {
  importedName: string
  resolvedPath: string
}

const API_CALL_TYPES = new Set<string>([
  'fetch',
  'axios',
  'trpc_hook',
  'tsrpc_call_api',
  'tsrpc_listen_msg',
])

function isCallsApiMetadata(metadata: OmniEdge['metadata']): metadata is CallsApiMetadata {
  return 'callType' in metadata
    && typeof metadata.callType === 'string'
    && API_CALL_TYPES.has(metadata.callType)
    && 'callLine' in metadata
    && typeof metadata.callLine === 'number'
}

function routeFromMetadata(node: OmniNode): string | undefined {
  const { metadata } = node
  return 'route' in metadata && typeof metadata.route === 'string'
    ? metadata.route
    : undefined
}

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
  private symbolResolver: SymbolResolver | null = null

  constructor(private tsConfigPath?: string) {
    if (tsConfigPath) {
      try {
        this.symbolResolver = new SymbolResolver(tsConfigPath)
      } catch {
        // tsconfig 不存在或无效：降级，不使用符号追踪
        this.symbolResolver = null
      }
    }
  }

  /**
   * 执行跨层连线（async，支持符号追踪）
   */
  async link(graph: OmniGraph): Promise<CrossLayerResult> {
    // 预构建 Map 索引，避免 O(n) 查找
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
    const edges: OmniEdge[] = []

    // 1. 前端 API 调用 → 后端路由
    const callsApiEdges = this.linkCallsApi(graph, nodeMap)
    edges.push(...callsApiEdges)

    // 2. 后端路由 → handler
    const handlesEdges = this.linkHandles(graph, nodeMap)
    edges.push(...handlesEdges)

    // 3. handler → service
    const callsServiceEdges = this.linkCallsService(graph, nodeMap)
    edges.push(...callsServiceEdges)

    // 4. service/handler → DB model（优先符号追踪）
    const queriesDbEdges = await this.linkQueriesDbWithSymbols(graph, nodeMap)
    edges.push(...queriesDbEdges)

    // 5. Kotlin 跨层连线
    const kotlinEdges = this.linkKotlinCrossLayer(graph, nodeMap)
    edges.push(...kotlinEdges)

    return {
      edges,
      stats: {
        callsApiEdges: callsApiEdges.length,
        handlesEdges: handlesEdges.length,
        callsServiceEdges: callsServiceEdges.length,
        queriesDbEdges: queriesDbEdges.length,
      },
    }
  }

  /**
   * 连接前端 API 调用 → 后端路由
   */
  private linkCallsApi(graph: OmniGraph, nodeMap: Map<string, OmniNode>): OmniEdge[] {
    const edges: OmniEdge[] = []

    // 获取所有 calls_api / sends_msg / listens_msg 边
    const existingCallEdges = graph.edges.filter(e => e.type === 'calls_api' || e.type === 'sends_msg' || e.type === 'listens_msg')

    // 获取所有后端路由节点
    const apiRoutes = graph.nodes.filter(n =>
      n.type === 'api_route' || n.type === 'trpc_procedure' || n.type === 'express_route' || n.type === 'kotlin_route' || n.type === 'tsrpc_service' || n.type === 'tsrpc_api' || n.type === 'tsrpc_msg'
    )

    // 获取所有组件节点（用于匹配 source）
    const components = graph.nodes.filter(n => isNodeOfType(n, 'component'))

    // 尝试匹配
    for (const callEdge of existingCallEdges) {
      const targetNode = nodeMap.get(callEdge.target)

      // 如果 target 已经是有效节点，跳过
      if (targetNode) {
        continue
      }

      // 尝试修复 source：找到同一文件中的实际组件
      let sourceId = callEdge.source
      const sourceNode = nodeMap.get(callEdge.source)
      if (!sourceNode) {
        // source 节点不存在，从文件路径匹配
        const sourceParts = callEdge.source.split(':')
        if (sourceParts.length >= 2) {
          const filePath = sourceParts[1]
          // 优先找 page 组件（通常发起 API 调用的是页面）
          const matchedComponent = components.find(c =>
            c.filePath === filePath && c.metadata.isPage
          ) || components.find(c => c.filePath === filePath)
          if (matchedComponent) {
            sourceId = matchedComponent.id
          }
        }
      }

      // 从 target ID 中提取 URL
      // target ID 格式：api_route:unknown:/api/xxx 或 trpc_procedure:unknown:router.procedure
      const targetParts = callEdge.target.split(':')
      const url = targetParts.slice(2).join(':') // 处理 URL 中可能包含 : 的情况

      if (!isCallsApiMetadata(callEdge.metadata)) continue

      const metadata = callEdge.metadata
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
      } else if (callType === 'tsrpc_call_api' || callType === 'tsrpc_listen_msg') {
        // TSRPC client.callApi / client.listenMsg / client.sendMsg：匹配 service/msg 路径
        const matchedService = this.matchTsrpcService(url, apiRoutes)

        // 根据原始边类型决定新边类型
        const resolvedEdgeType = callEdge.type === 'listens_msg' ? 'listens_msg'
          : callEdge.type === 'sends_msg' ? 'sends_msg'
          : 'calls_api'

        if (matchedService) {
          const newEdge: OmniEdge = {
            id: createEdgeId(sourceId, resolvedEdgeType, matchedService.id),
            source: sourceId,
            target: matchedService.id,
            type: resolvedEdgeType,
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
    const fuzzyMatch = procedures.find(p =>
      isNodeOfType(p, 'trpc_procedure')
        && p.metadata.routerName === router
        && p.metadata.procedureName === proc
    )

    return fuzzyMatch || null
  }

  /**
   * 匹配 TSRPC service
   * @param servicePath - client.callApi 的第一个参数（如 'Example' 或 'user/login'）
   * @param services - 所有 tsrpc_service 节点
   *
   * 匹配策略（按优先级）：
   * 1. 精确匹配 servicePath metadata（大小写不敏感）
   * 2. 路径最后一段匹配（处理 'Example' vs 'user/example'）
   * 3. 按节点名匹配（去掉 Api 前缀，大小写不敏感）
   */
  private matchTsrpcService(
    servicePath: string,
    services: OmniNode[]
  ): OmniNode | null {
    // 规范化路径
    const normalizedPath = servicePath.replace(/^\//, '').replace(/\/$/, '')
    const normalizedLower = normalizedPath.toLowerCase()

    // 1. 精确匹配 apiPath/servicePath metadata（大小写不敏感）
    const exactMatch = services.find(n => {
      if (isNodeOfType(n, 'tsrpc_api')) {
        return n.metadata.apiPath.toLowerCase() === normalizedLower
      }
      if (isNodeOfType(n, 'tsrpc_service')) {
        return n.metadata.servicePath.toLowerCase() === normalizedLower
      }
      if (isNodeOfType(n, 'tsrpc_msg')) {
        return n.metadata.msgName.toLowerCase() === normalizedLower
      }
      return false
    })
    if (exactMatch) return exactMatch

    // 2. 路径最后一段匹配（大小写不敏感）
    const lastSegment = normalizedPath.split('/').pop()?.toLowerCase()
    if (lastSegment) {
      const fuzzyMatch = services.find(n => {
        if (isNodeOfType(n, 'tsrpc_api')) {
          return n.metadata.apiPath.split('/').pop()?.toLowerCase() === lastSegment
        }
        if (isNodeOfType(n, 'tsrpc_service')) {
          return n.metadata.servicePath.split('/').pop()?.toLowerCase() === lastSegment
        }
        if (isNodeOfType(n, 'tsrpc_msg')) {
          return n.metadata.msgName.toLowerCase() === lastSegment
        }
        return false
      })
      if (fuzzyMatch) return fuzzyMatch
    }

    // 3. 按节点名匹配（去掉 Api/Ptl/Msg 前缀，大小写不敏感）
    const nameMatch = services.find(n => {
      if (!isNodeOfType(n, 'tsrpc_api') && !isNodeOfType(n, 'tsrpc_service') && !isNodeOfType(n, 'tsrpc_msg')) return false
      const strippedName = n.name.replace(/^(Api|Ptl|Msg)/i, '').toLowerCase()
      return strippedName === normalizedLower || strippedName === lastSegment
    })

    return nameMatch || null
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
      const route = routeFromMetadata(r)
      if (!route) return false
      return this.normalizeUrl(route) === normalizedUrl
    })
    if (exactMatch) return exactMatch

    // 去掉 /api/ 前缀匹配
    const withoutApi = normalizedUrl.replace(/^\/api/, '')
    const withoutApiMatch = routes.find(r => {
      const route = routeFromMetadata(r)
      if (!route) return false
      return this.normalizeUrl(route) === withoutApi
    })
    if (withoutApiMatch) return withoutApiMatch

    // 处理基础路径前缀（如 /byresume/api/xxx → /api/xxx）
    const basePrefixMatch = normalizedUrl.match(/^\/[^/]+(\/api\/.+)$/)
    if (basePrefixMatch) {
      const withoutPrefix = basePrefixMatch[1]
      const prefixMatch = routes.find(r => {
        const route = routeFromMetadata(r)
        if (!route) return false
        return this.normalizeUrl(route) === withoutPrefix
      })
      if (prefixMatch) return prefixMatch
    }

    // 精确路径段匹配（最后一段路径匹配）
    const urlSegments = normalizedUrl.split('/').filter(Boolean)
    const lastSegment = urlSegments[urlSegments.length - 1]
    if (lastSegment) {
      const segmentMatch = routes.find(r => {
        const route = routeFromMetadata(r)
        if (!route) return false
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

  /**
   * 连接 api_route / trpc_procedure / express_route → handler
   * 产生 handles 边
   */
  private linkHandles(graph: OmniGraph, nodeMap: Map<string, OmniNode>): OmniEdge[] {
    const edges: OmniEdge[] = []

    // 处理 Next.js API Route 节点
    const apiRouteNodes = graph.nodes.filter(n => isNodeOfType(n, 'api_route'))
    for (const routeNode of apiRouteNodes) {
      const methodsStr = routeNode.metadata.method
      if (!methodsStr) continue

      // method 可能是逗号分隔的："GET,POST" → 拆分为每个方法单独创建 handler
      const methods = methodsStr.split(',').map((m: string) => m.trim()).filter(Boolean)

      for (const method of methods) {
        // 查找同文件中的 handler 节点
        const expectedHandlerId = `handler:${routeNode.filePath}:${method}`
        const handlerNode = nodeMap.get(expectedHandlerId)

        if (handlerNode) {
          edges.push(makeEdge(routeNode.id, handlerNode.id, 'handles', 'certain', {}))
          continue
        }

        // handler 节点不存在时：动态创建（内联 handler）
        const syntheticHandler = createTypedNode({
          id: `handler:${routeNode.filePath}:${method}`,
          type: 'handler',
          name: `${method} handler`,
          filePath: routeNode.filePath,
          line: routeNode.line,
          column: routeNode.column,
          metadata: {
            functionName: method,
            routeId: routeNode.id,
            isSynthetic: true,
          },
        })
        graph.nodes.push(syntheticHandler)
        nodeMap.set(syntheticHandler.id, syntheticHandler)
        edges.push(makeEdge(routeNode.id, syntheticHandler.id, 'handles', 'certain', {}))
      }
    }

    // 处理 tRPC procedure 节点
    const trpcNodes = graph.nodes.filter(n => isNodeOfType(n, 'trpc_procedure'))
    for (const proc of trpcNodes) {
      const handlerId = `handler:${proc.filePath}:${proc.name}:resolver`
      if (!nodeMap.has(handlerId)) {
        const resolver = createTypedNode({
          id: handlerId,
          type: 'handler',
          name: `${proc.name} resolver`,
          filePath: proc.filePath,
          line: proc.line,
          column: proc.column,
          metadata: {
            functionName: proc.name,
            routeId: proc.id,
            isSynthetic: true,
          },
        })
        graph.nodes.push(resolver)
        nodeMap.set(resolver.id, resolver)
      }
      edges.push(makeEdge(proc.id, handlerId, 'handles', 'certain', {}))
    }

    // 处理 TSRPC service/api 节点
    const tsrpcNodes = graph.nodes.filter(n => isNodeOfType(n, 'tsrpc_service') || isNodeOfType(n, 'tsrpc_api'))
    for (const svc of tsrpcNodes) {
      const handlerId = `handler:${svc.filePath}:${svc.name}:handler`
      if (!nodeMap.has(handlerId)) {
        const handler = createTypedNode({
          id: handlerId,
          type: 'handler',
          name: `${svc.name} handler`,
          filePath: svc.filePath,
          line: svc.line,
          column: svc.column,
          metadata: {
            functionName: svc.name,
            routeId: svc.id,
            isSynthetic: true,
          },
        })
        graph.nodes.push(handler)
        nodeMap.set(handler.id, handler)
      }
      edges.push(makeEdge(svc.id, handlerId, 'handles', 'certain', {}))
    }

    // 处理 Express route 节点
    const expressNodes = graph.nodes.filter(n => isNodeOfType(n, 'express_route'))
    for (const route of expressNodes) {
      const handlerName = 'handlerName' in route.metadata && typeof route.metadata.handlerName === 'string'
        ? route.metadata.handlerName
        : undefined
      if (!handlerName) {
        // 内联 callback，创建 synthetic
        const handlerId = `handler:${route.filePath}:${route.name}:callback`
        if (!nodeMap.has(handlerId)) {
          const syntheticHandler = createTypedNode({
            id: handlerId,
            type: 'handler',
            name: `${route.name} callback`,
            filePath: route.filePath,
            line: route.line,
            column: route.column,
            metadata: { functionName: route.name, routeId: route.id, isSynthetic: true },
          })
          graph.nodes.push(syntheticHandler)
          nodeMap.set(syntheticHandler.id, syntheticHandler)
        }
        edges.push(makeEdge(route.id, handlerId, 'handles', 'inferred', {}))
      } else {
        // 具名 handler
        const existing = graph.nodes.find(n =>
          n.type === 'handler' && n.name === handlerName
        )
        if (existing) {
          edges.push(makeEdge(route.id, existing.id, 'handles', 'certain', {}))
        }
      }
    }

    return edges
  }

  /**
   * 连接 handler → service
   * 产生 calls_service 边
   */
  private linkCallsService(graph: OmniGraph, nodeMap: Map<string, OmniNode>): OmniEdge[] {
    const edges: OmniEdge[] = []
    const handlerNodes = graph.nodes.filter(n => n.type === 'handler')
    const serviceNodes = graph.nodes.filter(n => n.type === 'service')

    // 预构建 service 节点索引（name + filePath）
    const serviceByName = new Map<string, OmniNode[]>()
    for (const s of serviceNodes) {
      const existing = serviceByName.get(s.name) || []
      existing.push(s)
      serviceByName.set(s.name, existing)
    }

    for (const handler of handlerNodes) {
      const filePath = handler.filePath
      const serviceImports = this.extractServiceImports(filePath)

      for (const imp of serviceImports) {
        // 在现有 service 节点中按名称查找
        const candidates = serviceByName.get(imp.importedName)
        let matched: OmniNode | null = null

        if (candidates) {
          // 优先精确匹配 filePath
          matched = candidates.find(c => c.filePath === imp.resolvedPath) || candidates[0]
        }

        if (matched) {
          edges.push(makeEdge(handler.id, matched.id, 'calls_service', 'certain', {}))
        } else if (this.looksLikeServicePath(imp.resolvedPath)) {
          // 只在路径看起来像 service 时才创建 synthetic 节点
          const serviceId = `service:${imp.resolvedPath}:${imp.importedName}`
          if (!nodeMap.has(serviceId)) {
            const syntheticService = createTypedNode({
              id: serviceId,
              type: 'service',
              name: imp.importedName,
              filePath: imp.resolvedPath,
              line: 0,
              column: 0,
              metadata: { className: null, methodName: imp.importedName, isSynthetic: true, importedFrom: filePath },
            })
            graph.nodes.push(syntheticService)
            nodeMap.set(syntheticService.id, syntheticService)
          }
          edges.push(makeEdge(handler.id, serviceId, 'calls_service', 'inferred', {}))
        }
      }
    }

    return edges
  }

  /**
   * 连接 handler/service → db_model
   * 优先使用符号追踪，降级到正则扫描
   */
  private async linkQueriesDbWithSymbols(graph: OmniGraph, nodeMap: Map<string, OmniNode>): Promise<OmniEdge[]> {
    const edges: OmniEdge[] = []
    const dbNodes = graph.nodes.filter(n => n.type === 'db_model')
    const callerNodes = graph.nodes.filter(n =>
      n.type === 'handler' || n.type === 'service' || n.type === 'api_route'
    )

    // 预构建 db model 名称索引（大小写不敏感）
    const dbNodeByName = new Map<string, OmniNode>()
    for (const dbNode of dbNodes) {
      dbNodeByName.set(dbNode.name.toLowerCase(), dbNode)
    }

    for (const caller of callerNodes) {
      let dbCalls: DbCall[]

      if (this.symbolResolver) {
        // Phase 2：精确符号追踪
        try {
          const result = await this.symbolResolver.traceHandlerToDb(caller)
          dbCalls = result.dbCalls

          // 将追踪中发现的中间 service 节点动态加入图，并连接调用链
          const callChain = result.callChain
          for (let i = 0; i < callChain.length; i++) {
            const nodeId = callChain[i]
            if (nodeId.startsWith('service:') && !nodeMap.has(nodeId)) {
              const parts = nodeId.split(':')
              const syntheticService = createTypedNode({
                id: nodeId,
                type: 'service',
                name: parts[2] ?? 'unknown',
                filePath: parts[1] ?? '',
                line: 0, column: 0,
                metadata: {
                  className: null,
                  methodName: parts[2] ?? 'unknown',
                  discoveredBySymbolResolver: true,
                },
              })
              graph.nodes.push(syntheticService)
              nodeMap.set(syntheticService.id, syntheticService)
            }
            // 连接调用链中的相邻节点
            if (i > 0) {
              const prevId = callChain[i - 1]
              const edgeId = `${prevId}--calls_service--${nodeId}`
              if (!edges.find(e => e.id === edgeId)) {
                edges.push(makeEdge(prevId, nodeId, 'calls_service', 'inferred', {}))
              }
            }
          }
        } catch {
          // 符号追踪失败：降级到正则扫描
          dbCalls = this.scanFileForDbCalls(caller.filePath)
        }
      } else {
        // Phase 1 降级：正则扫描
        dbCalls = this.scanFileForDbCalls(caller.filePath)
      }

      for (const call of dbCalls) {
        const dbNode = dbNodeByName.get(call.modelName.toLowerCase())

        if (dbNode) {
          const edgeId = createEdgeId(caller.id, 'queries_db', dbNode.id)
          if (!graph.edges.find(e => e.id === edgeId)) {
            edges.push(makeEdge(caller.id, dbNode.id, 'queries_db', call.confidence, {}))
          }
        }
      }
    }

    return edges
  }

  /**
   * 正则扫描文件中的 DB 调用（Phase 1 降级方案）
   */
  private scanFileForDbCalls(filePath: string): DbCall[] {
    const calls: DbCall[] = []
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch {
      return calls
    }

    // Prisma 模式：prisma.user.findMany / ctx.prisma.booking.create / this.db.xxx.findFirst
    const PRISMA_PATTERN = /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\s*\.\s*(\w+)\s*\.\s*(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)/g

    // TypeORM Repository 模式：this.userRepo.find / this.bookingRepository.findOne
    const TYPEORM_REPO_PATTERN = /this\.(\w+)(?:Repo|Repository)\s*\.\s*(find|findOne|findOneBy|findBy|findOneOrFail|save|remove|delete|update|insert|count|query)/g

    // TypeORM EntityManager 模式：this.entityManager.save(User, ...) / this.manager.find(Booking)
    const TYPEORM_MANAGER_PATTERN = /this\.(?:entityManager|manager)\s*\.\s*(save|find|findOne|findOneBy|findBy|remove|delete|update|insert|count)\s*(?:<\s*(\w+)\s*>)?\s*\(\s*(\w+)/g

    let match: RegExpExecArray | null

    // Prisma
    PRISMA_PATTERN.lastIndex = 0
    while ((match = PRISMA_PATTERN.exec(content)) !== null) {
      calls.push({
        modelName: capitalize(match[1]),
        operation: match[2],
        filePath,
        line: 0,
        confidence: 'certain',
      })
    }

    // TypeORM Repository
    TYPEORM_REPO_PATTERN.lastIndex = 0
    while ((match = TYPEORM_REPO_PATTERN.exec(content)) !== null) {
      const entityName = capitalize(match[1].replace(/(Repo|Repository|Dao)$/i, ''))
      calls.push({
        modelName: entityName,
        operation: match[2],
        filePath,
        line: 0,
        confidence: 'certain',
      })
    }

    // TypeORM EntityManager
    TYPEORM_MANAGER_PATTERN.lastIndex = 0
    while ((match = TYPEORM_MANAGER_PATTERN.exec(content)) !== null) {
      const entityName = match[2] || capitalize(match[3])
      calls.push({
        modelName: entityName,
        operation: match[1],
        filePath,
        line: 0,
        confidence: 'inferred',
      })
    }

    return calls
  }

  /**
   * 判断路径是否看起来像 service/repository 文件
   * 排除 handler/test/mock 等非 service 文件
   */
  private looksLikeServicePath(importPath: string): boolean {
    // 排除 handler/test/mock/config 等
    if (/(?:handler|test|mock|config|constant|util|helper)/i.test(importPath)) return false
    // 包含 service/repository/di 等关键词
    return /(?:service|Service|repository|Repository|repo|Repo|di\/)/i.test(importPath)
  }

  /**
   * 从文件中提取 service 相关 import
   * 匹配：service/repository 路径、@calcom/features/*、@calcom/lib/*
   */
  private extractServiceImports(filePath: string): ServiceImport[] {
    const imports: ServiceImport[] = []
    try {
      const content = fs.readFileSync(filePath, 'utf-8')

      // 匹配所有 import { ... } from '...' 语句
      const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g
      let match: RegExpExecArray | null

      while ((match = importRegex.exec(content)) !== null) {
        const namedImports = match[1]
        const fromPath = match[2]

        // 跳过类型导入
        if (match[0].includes('import type')) continue

        // 只处理 service/repository 相关路径
        const isServicePath = /(?:service|Service|repository|Repository|repo|Repo|di\/)/i.test(fromPath)
        // @calcom/features/* 只匹配包含 service/repository/di 的子路径
        const isFeaturesService = /^@calcom\/features\/.*(?:service|Service|repository|Repository|repo|Repo|di\/)/i.test(fromPath)
        // @calcom/lib/* 匹配 server/ 或 service 相关
        const isLibService = /^@calcom\/lib\/(?:server\/|.*(?:service|Service))/i.test(fromPath)

        if (!isServicePath && !isFeaturesService && !isLibService) continue

        namedImports.split(',').forEach(name => {
          const trimmed = name.trim().split(/\s+as\s+/)[0].trim()
          // 跳过类型前缀和无效标识符
          if (trimmed && !trimmed.startsWith('type ') && /^[a-zA-Z_$]/.test(trimmed)) {
            imports.push({
              importedName: trimmed,
              resolvedPath: this.resolveRelativePath(filePath, fromPath),
            })
          }
        })
      }
    } catch {
      // 文件读取失败，返回空数组（降级原则）
    }
    return imports
  }

  /**
   * 解析 import 路径为标准化路径
   */
  private resolveRelativePath(fromFile: string, importPath: string): string {
    if (importPath.startsWith('.')) {
      // 相对路径：解析为绝对路径，然后转为 POSIX 格式
      const resolved = path.resolve(path.dirname(fromFile), importPath)
      return resolved.replace(/\\/g, '/')
    }
    // workspace 路径（@calcom/...）：直接返回
    return importPath
  }

  /**
   * Kotlin 跨层连线
   *
   * 连接：
   * - kotlin_route → kotlin_function (handles)
   * - kotlin_function → kotlin_class @Service (calls_service)
   * - kotlin_class @Service → db_model (queries_db)
   */
  private linkKotlinCrossLayer(graph: OmniGraph, nodeMap: Map<string, OmniNode>): OmniEdge[] {
    const edges: OmniEdge[] = []

    const kotlinRoutes = graph.nodes.filter(n => isNodeOfType(n, 'kotlin_route'))
    const kotlinFunctions = graph.nodes.filter(n => isNodeOfType(n, 'kotlin_function'))
    const kotlinClasses = graph.nodes.filter(n => isNodeOfType(n, 'kotlin_class'))
    const dbModels = graph.nodes.filter(n => n.type === 'db_model')

    // 1. kotlin_route → kotlin_function (handles)
    for (const route of kotlinRoutes) {
      // 查找同文件中的 kotlin_function（Spring: 函数名匹配，Ktor: 函数名匹配）
      const matchingFn = kotlinFunctions.find(fn =>
        fn.filePath === route.filePath && fn.name === route.name
      )
      if (matchingFn) {
        edges.push(makeEdge(route.id, matchingFn.id, 'handles', 'certain', { handlerName: matchingFn.name }))
      }
    }

    // 2. kotlin_function → kotlin_class @Service (calls_service)
    for (const fn of kotlinFunctions) {
      // 查找同文件中的 @Service 类
      const serviceClass = kotlinClasses.find(cls =>
        cls.filePath === fn.filePath && cls.metadata.annotations.includes('Service')
      )
      if (serviceClass) {
        edges.push(makeEdge(fn.id, serviceClass.id, 'calls_service', 'inferred', { serviceName: serviceClass.name }))
      }
    }

    // 3. kotlin_class @Repository → db_model (queries_db)
    for (const cls of kotlinClasses) {
      const isRepository = cls.metadata.annotations.includes('Repository')
      if (!isRepository) continue

      // 查找同文件中的 db_model
      for (const dbModel of dbModels) {
        if (dbModel.filePath === cls.filePath) {
          edges.push(makeEdge(cls.id, dbModel.id, 'queries_db', 'inferred', { operation: 'repository' }))
        }
      }
    }

    return edges
  }
}
