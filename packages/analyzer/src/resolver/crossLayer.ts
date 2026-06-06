/**
 * 跨层连线器
 *
 * 连接前端调用 → 后端路由 → DB 操作的完整链路。
 * 处理路径变体匹配（/api/booking vs booking.create）。
 *
 * 遵循"降级而非崩溃"原则。
 */

import type { OmniGraph, OmniNode, OmniEdge, EdgeType, ComponentMetadata, CallsApiMetadata, PageMetadata, ApiRouteMetadata, TrpcProcedureMetadata } from '@omnivis/shared'
import { createEdgeId } from '@omnivis/shared'
import * as fs from 'fs'
import * as path from 'path'
import { SymbolResolver, type DbCall } from './symbolResolver'

// ============================================================
// 辅助函数
// ============================================================

function makeEdge(
  source: string,
  target: string,
  type: EdgeType,
  confidence: 'certain' | 'inferred',
  metadata: Record<string, unknown> = {}
): OmniEdge {
  return {
    id: createEdgeId(source, type, target),
    source,
    target,
    type,
    confidence,
    metadata,
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

interface ServiceImport {
  importedName: string
  resolvedPath: string
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

    // 获取所有 calls_api 边
    const existingCallEdges = graph.edges.filter(e => e.type === 'calls_api')

    // 获取所有后端路由节点
    const apiRoutes = graph.nodes.filter(n =>
      n.type === 'api_route' || n.type === 'trpc_procedure' || n.type === 'express_route' || n.type === 'kotlin_route'
    )

    // 获取所有组件节点（用于匹配 source）
    const components = graph.nodes.filter(n => n.type === 'component')

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
            c.filePath === filePath && (c.metadata as ComponentMetadata)?.isPage
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

      const metadata = callEdge.metadata as CallsApiMetadata
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
      const meta = p.metadata as TrpcProcedureMetadata
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
      const route = (r.metadata as { route?: string })?.route
      if (!route) return false
      return this.normalizeUrl(route) === normalizedUrl
    })
    if (exactMatch) return exactMatch

    // 去掉 /api/ 前缀匹配
    const withoutApi = normalizedUrl.replace(/^\/api/, '')
    const withoutApiMatch = routes.find(r => {
      const route = (r.metadata as { route?: string })?.route
      if (!route) return false
      return this.normalizeUrl(route) === withoutApi
    })
    if (withoutApiMatch) return withoutApiMatch

    // 处理基础路径前缀（如 /byresume/api/xxx → /api/xxx）
    const basePrefixMatch = normalizedUrl.match(/^\/[^/]+(\/api\/.+)$/)
    if (basePrefixMatch) {
      const withoutPrefix = basePrefixMatch[1]
      const prefixMatch = routes.find(r => {
        const route = (r.metadata as { route?: string })?.route
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
        const route = (r.metadata as { route?: string })?.route
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
    const apiRouteNodes = graph.nodes.filter(n => n.type === 'api_route')
    for (const routeNode of apiRouteNodes) {
      const meta = routeNode.metadata as ApiRouteMetadata
      const methodsStr = meta?.method
      if (!methodsStr) continue

      // method 可能是逗号分隔的："GET,POST" → 拆分为每个方法单独创建 handler
      const methods = methodsStr.split(',').map((m: string) => m.trim()).filter(Boolean)

      for (const method of methods) {
        // 查找同文件中的 handler 节点
        const expectedHandlerId = `handler:${routeNode.filePath}:${method}`
        const handlerNode = nodeMap.get(expectedHandlerId)

        if (handlerNode) {
          edges.push(makeEdge(routeNode.id, handlerNode.id, 'handles', 'certain'))
          continue
        }

        // handler 节点不存在时：动态创建（内联 handler）
        const syntheticHandler: OmniNode = {
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
        }
        graph.nodes.push(syntheticHandler)
        nodeMap.set(syntheticHandler.id, syntheticHandler)
        edges.push(makeEdge(routeNode.id, syntheticHandler.id, 'handles', 'certain'))
      }
    }

    // 处理 tRPC procedure 节点
    const trpcNodes = graph.nodes.filter(n => n.type === 'trpc_procedure')
    for (const proc of trpcNodes) {
      const handlerId = `handler:${proc.filePath}:${proc.name}:resolver`
      if (!nodeMap.has(handlerId)) {
        const resolver: OmniNode = {
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
        }
        graph.nodes.push(resolver)
        nodeMap.set(resolver.id, resolver)
      }
      edges.push(makeEdge(proc.id, handlerId, 'handles', 'certain'))
    }

    // 处理 Express route 节点
    const expressNodes = graph.nodes.filter(n => n.type === 'express_route')
    for (const route of expressNodes) {
      const meta = route.metadata as Record<string, unknown>
      const handlerName = meta?.handlerName as string | undefined
      if (!handlerName) {
        // 内联 callback，创建 synthetic
        const handlerId = `handler:${route.filePath}:${route.name}:callback`
        if (!nodeMap.has(handlerId)) {
          const syntheticHandler: OmniNode = {
            id: handlerId,
            type: 'handler',
            name: `${route.name} callback`,
            filePath: route.filePath,
            line: route.line,
            column: route.column,
            metadata: { functionName: route.name, routeId: route.id, isSynthetic: true },
          }
          graph.nodes.push(syntheticHandler)
          nodeMap.set(syntheticHandler.id, syntheticHandler)
        }
        edges.push(makeEdge(route.id, handlerId, 'handles', 'inferred'))
      } else {
        // 具名 handler
        const existing = graph.nodes.find(n =>
          n.type === 'handler' && n.name === handlerName
        )
        if (existing) {
          edges.push(makeEdge(route.id, existing.id, 'handles', 'certain'))
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

    for (const handler of handlerNodes) {
      const filePath = handler.filePath

      // 策略1：查找该文件里的 import 语句，找 service 路径的 import
      const serviceImports = this.extractServiceImports(filePath)

      for (const imp of serviceImports) {
        // 在现有 service 节点中查找匹配
        const matched = serviceNodes.find(s =>
          s.filePath.includes(imp.resolvedPath) && s.name === imp.importedName
        )
        if (matched) {
          edges.push(makeEdge(handler.id, matched.id, 'calls_service', 'certain'))
        } else {
          // service 节点不存在 → 动态创建 synthetic service 节点
          const serviceId = `service:${imp.resolvedPath}:${imp.importedName}`
          if (!nodeMap.has(serviceId)) {
            const syntheticService: OmniNode = {
              id: serviceId,
              type: 'service',
              name: imp.importedName,
              filePath: imp.resolvedPath,
              line: 0,
              column: 0,
              metadata: { className: null, methodName: imp.importedName, isSynthetic: true, importedFrom: filePath },
            }
            graph.nodes.push(syntheticService)
            nodeMap.set(syntheticService.id, syntheticService)
          }
          edges.push(makeEdge(handler.id, serviceId, 'calls_service', 'inferred'))
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

          // 将追踪中发现的中间 service 节点动态加入图
          for (const nodeId of result.callChain) {
            if (nodeId.startsWith('service:') && !nodeMap.has(nodeId)) {
              const parts = nodeId.split(':')
              const syntheticService: OmniNode = {
                id: nodeId,
                type: 'service',
                name: parts[2] ?? 'unknown',
                filePath: parts[1] ?? '',
                line: 0, column: 0,
                metadata: { discoveredBySymbolResolver: true },
              }
              graph.nodes.push(syntheticService)
              nodeMap.set(syntheticService.id, syntheticService)
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
            edges.push(makeEdge(caller.id, dbNode.id, 'queries_db', call.confidence))
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
   * 从文件中提取 service 相关 import
   */
  private extractServiceImports(filePath: string): ServiceImport[] {
    const imports: ServiceImport[] = []
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        // 匹配：import { xxx } from '../services/...'
        // 匹配：import XxxService from '...'
        const importMatch = line.match(
          /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]*(?:service|Service|repository|Repository|repo|Repo)[^'"]*)['"]|import\s+(\w+Service|\w+Repository|\w+Repo)\s+from\s+['"]([^'"]+)['"]/i
        )
        if (importMatch) {
          const namedImports = importMatch[1]
          const fromPath = importMatch[2] || importMatch[4]
          const defaultImport = importMatch[3]

          if (namedImports) {
            namedImports.split(',').forEach(name => {
              const trimmed = name.trim()
              if (trimmed) {
                imports.push({
                  importedName: trimmed,
                  resolvedPath: this.resolveRelativePath(filePath, fromPath),
                })
              }
            })
          }
          if (defaultImport) {
            imports.push({
              importedName: defaultImport,
              resolvedPath: this.resolveRelativePath(filePath, fromPath),
            })
          }
        }
      }
    } catch {
      // 文件读取失败，返回空数组（降级原则）
    }
    return imports
  }

  /**
   * 解析相对路径为绝对路径
   */
  private resolveRelativePath(fromFile: string, importPath: string): string {
    if (importPath.startsWith('.')) {
      return path.resolve(path.dirname(fromFile), importPath)
    }
    // path alias 或 node_modules，返回原始值作为 fallback
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

    const kotlinRoutes = graph.nodes.filter(n => n.type === 'kotlin_route')
    const kotlinFunctions = graph.nodes.filter(n => n.type === 'kotlin_function')
    const kotlinClasses = graph.nodes.filter(n => n.type === 'kotlin_class')
    const dbModels = graph.nodes.filter(n => n.type === 'db_model')

    // 1. kotlin_route → kotlin_function (handles)
    for (const route of kotlinRoutes) {
      const routeMeta = route.metadata as import('@omnivis/shared').KotlinRouteMetadata
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
      const fnMeta = fn.metadata as import('@omnivis/shared').KotlinFunctionMetadata
      // 查找同文件中的 @Service 类
      const serviceClass = kotlinClasses.find(cls => {
        const meta = cls.metadata as import('@omnivis/shared').KotlinClassMetadata
        return cls.filePath === fn.filePath && meta.annotations.includes('Service')
      })
      if (serviceClass) {
        edges.push(makeEdge(fn.id, serviceClass.id, 'calls_service', 'inferred', { serviceName: serviceClass.name }))
      }
    }

    // 3. kotlin_class @Repository → db_model (queries_db)
    for (const cls of kotlinClasses) {
      const meta = cls.metadata as import('@omnivis/shared').KotlinClassMetadata
      const isRepository = meta.annotations.includes('Repository')
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
