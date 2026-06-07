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

// ============================================================
// Auth 检测器
// ============================================================

export class AuthDetector {
  /**
   * 检测图中所有 API 路由的鉴权覆盖
   */
  detect(graph: OmniGraph, projectRoot: string): Issue[] {
    const issues: Issue[] = []

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
        const fileIssues = this.analyzeFile(fullPath, nodes, projectRoot)
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
  private analyzeFile(fullPath: string, nodes: OmniNode[], projectRoot: string): Issue[] {
    const issues: Issue[] = []

    const content = fs.readFileSync(fullPath, 'utf-8')

    // 快速检查：文件中是否有 auth 函数调用
    const hasAuthCall = this.hasAuthFunction(content)

    // 收集文件中导入的 auth 函数
    const importedAuthFunctions = this.collectImportedAuthFunctions(content)

    for (const node of nodes) {
      // 跳过公开路由
      const route = (node.metadata as Record<string, unknown>)?.route as string
      if (route && this.isPublicRoute(route)) continue

      // 如果文件整体有 auth 调用，认为已覆盖
      if (hasAuthCall || importedAuthFunctions.size > 0) continue

      // 检查节点级别的 auth 调用
      const nodeContent = this.extractNodeContent(content, node.line)
      if (this.hasAuthFunction(nodeContent)) continue

      issues.push(this.createIssue(node))
    }

    return issues
  }

  /**
   * 快速检查内容中是否包含 auth 函数调用
   */
  private hasAuthFunction(content: string): boolean {
    for (const fn of AUTH_FUNCTIONS) {
      if (content.includes(fn)) return true
    }
    return false
  }

  /**
   * 收集文件中导入的 auth 函数
   */
  private collectImportedAuthFunctions(content: string): Set<string> {
    const imported = new Set<string>()

    // 匹配 import { ... } from '...'
    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null

    while ((m = importRegex.exec(content)) !== null) {
      const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())
      for (const name of names) {
        if (AUTH_FUNCTIONS.has(name)) {
          imported.add(name)
        }
      }
    }

    return imported
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
  private createIssue(node: OmniNode): Issue {
    const route = (node.metadata as Record<string, unknown>)?.route as string || node.name

    return {
      id: `auth-${node.id}`,
      type: 'unguarded_route',
      severity: 'critical',
      description: `API route "${route}" has no authentication guard`,
      locations: [
        { file: node.filePath, line: node.line, note: 'route definition' },
      ],
      relatedNodeIds: [node.id],
      relatedEdgeIds: [],
    }
  }
}
