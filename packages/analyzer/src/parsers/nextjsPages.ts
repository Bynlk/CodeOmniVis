/**
 * Next.js Pages Router 解析器
 *
 * 扫描 pages/ 目录提取页面路由和 API 路由。
 * 区分 pages/api/（API 路由）和 pages/（页面路由）。
 *
 * 遵循"降级而非崩溃"原则。
 */

import * as fs from 'fs'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  OmniEdge,
  ProjectMeta,
  PageMetadata,
  ApiRouteMetadata,
} from '@codeomnivis/shared'
import { createNodeId } from '@codeomnivis/shared'

// ============================================================
// Next.js Pages Router 解析器
// ============================================================

export class NextjsPagesParser implements Parser {
  readonly name = 'nextjs-pages'

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 只有当前端框架是 Next.js 时才处理
    if (projectMeta.frontendFramework !== 'next') {
      return false
    }

    const normalizedPath = filePath.replace(/\\/g, '/')

    // 匹配 pages/ 目录下的文件（排除 _app.tsx, _document.tsx 等特殊文件）
    if (!/(?:^|\/)pages\/.*\.(tsx|ts|jsx|js)$/.test(normalizedPath)) {
      return false
    }

    // 排除特殊文件
    if (/\/(_app|_document|_error)\.(tsx|ts|jsx|js)$/.test(normalizedPath)) {
      return false
    }

    // 排除测试文件
    if (/__tests__|\.test\.|\.spec\./.test(normalizedPath)) {
      return false
    }

    return true
  }

  /**
   * 执行解析
   */
  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      const normalizedPath = filePath.replace(/\\/g, '/')

      // 检查文件是否存在
      const fullPath = path.resolve(context.projectRoot, normalizedPath)
      if (!fs.existsSync(fullPath)) {
        errors.push({
          file: filePath,
          message: `File not found: ${fullPath}`,
          severity: 'warning',
        })
        return { nodes, edges, errors }
      }

      // 判断是 API 路由还是页面路由
      if (/(?:^|\/)pages\/api\//.test(normalizedPath)) {
        const node = this.parseApiRoute(normalizedPath, context.projectRoot)
        if (node) nodes.push(node)
      } else {
        const node = this.parsePage(normalizedPath, context.projectRoot)
        if (node) nodes.push(node)
      }
    } catch (err) {
      errors.push({
        file: filePath,
        message: `Next.js Pages Router parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 解析页面文件
   */
  private parsePage(filePath: string, projectRoot: string): OmniNode | null {
    const route = this.extractRoute(filePath)
    const line = this.findComponentLine(filePath, projectRoot)

    const isDynamic = /\[.*\]/.test(route)
    const params = this.extractParams(route)

    const nodeId = createNodeId('page', filePath, route)

    const metadata: PageMetadata = {
      route,
      isDynamic,
      params,
      isGroupLayout: false,
      layoutFile: null,
    }

    return {
      id: nodeId,
      type: 'page',
      name: route,
      filePath,
      line,
      column: 1,
      metadata,
    }
  }

  /**
   * 解析 API Route 文件
   */
  private parseApiRoute(filePath: string, projectRoot: string): OmniNode | null {
    const route = this.extractApiRoute(filePath)
    const line = this.findComponentLine(filePath, projectRoot)
    const methods = this.extractHttpMethods(filePath, projectRoot)

    const nodeId = createNodeId('api_route', filePath, route)

    const metadata: ApiRouteMetadata = {
      method: methods.join(','),
      route,
      isNextApiRoute: true,
    }

    return {
      id: nodeId,
      type: 'api_route',
      name: route,
      filePath,
      line,
      column: 1,
      metadata,
    }
  }

  /**
   * 从文件路径提取页面路由
   * pages/booking/[id].tsx → /booking/[id]
   */
  private extractRoute(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/')

    // 提取 pages/ 之后的部分
    const pagesMatch = normalizedPath.match(/(?:^|\/)pages\/(.*)$/)
    if (!pagesMatch) return '/'

    let routePath = pagesMatch[1]

    // 移除文件扩展名
    routePath = routePath.replace(/\.(tsx|ts|jsx|js)$/, '')

    // 处理 index 文件
    routePath = routePath.replace(/\/index$/, '')

    // 移除尾部的 /index
    if (routePath === 'index') {
      return '/'
    }

    // 确保以 / 开头
    return routePath.startsWith('/') ? routePath : `/${routePath}`
  }

  /**
   * 从文件路径提取 API 路由
   * pages/api/booking.ts → /api/booking
   */
  private extractApiRoute(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/')

    // 提取 pages/api/ 之后的部分
    const apiMatch = normalizedPath.match(/(?:^|\/)pages\/api\/(.*)$/)
    if (!apiMatch) return '/api'

    let routePath = apiMatch[1]

    // 移除文件扩展名
    routePath = routePath.replace(/\.(tsx|ts|jsx|js)$/, '')

    // 处理 index 文件
    if (routePath === 'index') {
      return '/api'
    }

    // 确保以 /api/ 开头
    return `/api/${routePath}`
  }

  /**
   * 提取动态路由参数
   */
  private extractParams(route: string): string[] {
    const params: string[] = []
    const paramPattern = /\[([^\]]+)\]/g
    let match

    while ((match = paramPattern.exec(route)) !== null) {
      const param = match[1]
      params.push(param.replace(/^\.\.\./, ''))
    }

    return params
  }

  /**
   * 查找组件定义的行号
   */
  private findComponentLine(filePath: string, projectRoot: string): number {
    try {
      const fullPath = path.resolve(projectRoot, filePath)
      if (!fs.existsSync(fullPath)) return 1

      const content = fs.readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')

      // 查找 export default function 或 export default
      for (let i = 0; i < lines.length; i++) {
        if (/export\s+default\s+(function|const|class)/.test(lines[i])) {
          return i + 1
        }
      }

      return 1
    } catch {
      return 1
    }
  }

  /**
   * 提取 HTTP methods（仅用于 API 路由）
   */
  private extractHttpMethods(filePath: string, projectRoot: string): string[] {
    try {
      const fullPath = path.resolve(projectRoot, filePath)
      if (!fs.existsSync(fullPath)) return ['GET']

      const content = fs.readFileSync(fullPath, 'utf-8')
      const methods: string[] = []

      // 匹配 export async function GET/POST/PUT/DELETE
      const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g
      let match

      while ((match = methodPattern.exec(content)) !== null) {
        methods.push(match[1])
      }

      // Pages Router API 路由通常是默认导出一个函数
      // 检查 req.method 的使用
      if (methods.length === 0) {
        if (/req\.method\s*===?\s*['"]POST['"]/.test(content)) {
          methods.push('POST')
        }
        if (/req\.method\s*===?\s*['"]PUT['"]/.test(content)) {
          methods.push('PUT')
        }
        if (/req\.method\s*===?\s*['"]DELETE['"]/.test(content)) {
          methods.push('DELETE')
        }
      }

      return methods.length > 0 ? methods : ['GET']
    } catch {
      return ['GET']
    }
  }
}
