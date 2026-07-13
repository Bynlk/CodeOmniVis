/**
 * Auth 覆盖检测器
 *
 * 检测 API 路由是否缺少鉴权守卫。
 * 扫描 handler 函数体内的 auth 函数调用。
 *
 * 遵循"降级而非崩溃"原则。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { OmniGraph, OmniNode, Issue } from '@codeomnivis/shared'
import { SourceScopeResolver } from './sourceScope'

// Auth 函数白名单
const AUTH_FUNCTIONS = new Set([
  // NextAuth / Next.js
  'getServerSession', 'getSession', 'auth',
  // JWT / Token
  'verifyToken', 'getToken', 'jwtVerify',
  // 通用
  'checkAuth', 'requireAuth', 'isAuthenticated', 'withAuth',
  'validateToken', 'authenticate', 'authorize',
  // NestJS
  'useGuards', 'canActivate',
  // Express middleware
  'passport.authenticate', 'verify',
  // tRPC middleware
  'protectedProcedure', 'isAuthed',
])

// 公开路由模式（不需要鉴权）
const PUBLIC_ROUTE_PATTERNS = [
  /^\/api\/health/,
  /^\/api\/webhook/,
  /^\/api\/auth/,
  /^\/api\/trpc\/public/,
  /^\/api\/public/,
  /^\/api\/cron/,
  /^\/api\/verify/,
  /^\/api\/csrf/,
  /^\/api\/geolocation/,
  /^\/api\/ip/,
  /^\/api\/email/,
  /^\/api\/avatar/,
  /^\/api\/signup/,
  /^\/api\/cancel/,
  /^\/api\/book$/,
  /^\/api\/track$/,
]

function routeFromNode(node: OmniNode): string | undefined {
  const { metadata } = node
  return 'route' in metadata && typeof metadata.route === 'string'
    ? metadata.route
    : undefined
}

// ============================================================
// Auth 检测器
// ============================================================

export class AuthDetector {
  /**
   * 检测图中所有 API 路由的鉴权覆盖
   */
  detect(graph: OmniGraph, projectRoot: string): Issue[] {
    const issues: Issue[] = []
    const sourceScopes = new SourceScopeResolver(projectRoot)

    // 检测 api_route 和 handler 节点
    const routeNodes = graph.nodes.filter(n =>
      n.type === 'api_route' || n.type === 'handler'
    )

    // 按文件分组
    const byFile = new Map<string, OmniNode[]>()
    for (const node of routeNodes) {
      const fullPath = this.resolveFilePath(node.filePath, projectRoot)
      if (!fullPath) continue
      const existing = byFile.get(fullPath) || []
      existing.push(node)
      byFile.set(fullPath, existing)
    }

    for (const [fullPath, nodes] of byFile) {
      if (!fs.existsSync(fullPath)) continue
      if (!/\.(tsx?|jsx?)$/.test(fullPath)) continue

      try {
        const fileIssues = this.analyzeFile(fullPath, nodes, sourceScopes)
        issues.push(...fileIssues)
      } catch {
        // 降级
      }
    }

    return issues
  }

  /**
   * 分析单个文件的鉴权覆盖
   */
  private analyzeFile(
    fullPath: string,
    nodes: OmniNode[],
    sourceScopes: SourceScopeResolver,
  ): Issue[] {
    const issues: Issue[] = []

    const content = fs.readFileSync(fullPath, 'utf-8')

    const handlers = nodes.filter(node => node.type === 'handler')
    const candidates = handlers.length > 0
      ? handlers
      : nodes.filter(node => node.type === 'api_route')

    for (const node of candidates) {
      const linkedRoute = node.type === 'handler' && node.metadata.routeId
        ? nodes.find(candidate => candidate.id === node.metadata.routeId)
        : undefined
      const route = routeFromNode(linkedRoute ?? node)

      // 跳过公开路由
      if (route && this.isPublicRoute(route)) continue

      // handler 必须在自己的函数作用域内调用鉴权；仅导入或其它方法调用不算覆盖。
      const scope = node.type === 'handler' ? sourceScopes.findScope(node) : null
      const nodeContent = scope?.getText()
        ?? (node.type === 'handler' ? this.extractNodeContent(content, node.line) : content)
      if (this.hasAuthFunction(nodeContent)) continue

      const methodRoute = node.type === 'handler' && route
        ? `${node.metadata.functionName} ${route}`
        : undefined
      issues.push(this.createIssue(node, methodRoute))
    }

    return issues
  }

  /**
   * 快速检查内容中是否包含 auth 函数调用
   */
  private hasAuthFunction(content: string): boolean {
    for (const fn of AUTH_FUNCTIONS) {
      if (fn === 'protectedProcedure' && /\bprotectedProcedure\b/.test(content)) return true
      const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\s*\\(`, 'i').test(content)) return true
    }
    return false
  }

  /**
   * 判断是否是公开路由
   */
  private isPublicRoute(route: string): boolean {
    return PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(route))
  }

  /**
   * 提取节点附近的代码内容（前后 50 行）
   */
  private extractNodeContent(content: string, line: number): string {
    const lines = content.split('\n')
    const start = Math.max(0, line - 5)
    const end = Math.min(lines.length, line + 50)
    return lines.slice(start, end).join('\n')
  }

  /**
   * 解析文件路径（支持 monorepo 子目录）
   */
  private resolveFilePath(filePath: string, projectRoot: string): string | null {
    const direct = path.resolve(projectRoot, filePath)
    if (fs.existsSync(direct)) return direct
    const appsWeb = path.resolve(projectRoot, 'apps', 'web', filePath)
    if (fs.existsSync(appsWeb)) return appsWeb
    const srcDir = path.resolve(projectRoot, 'src', filePath)
    if (fs.existsSync(srcDir)) return srcDir
    return null
  }

  /**
   * 创建未鉴权路由 Issue
   */
  private createIssue(node: OmniNode, routeLabel?: string): Issue {
    const route = routeLabel ?? routeFromNode(node) ?? node.name

    return {
      id: `auth-${node.id}`,
      type: 'unguarded_route',
      severity: 'critical',
      description: `API route "${route}" has no authentication guard`,
      messageKey: 'unguarded_route',
      messageParams: { route },
      locations: [
        { file: node.filePath, line: node.line, note: 'route definition' },
      ],
      relatedNodeIds: [node.id],
      relatedEdgeIds: [],
    }
  }
}
