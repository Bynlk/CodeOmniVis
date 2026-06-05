/**
 * Next.js App Router 解析器
 *
 * 扫描 app/ 目录提取 page.tsx 和 route.ts。
 * 路径转换：app/booking/[id]/page.tsx → /booking/[id]
 * 处理 route groups（(group)/）和 parallel routes（@slot）
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
} from '@omnivis/shared'
import { createNodeId } from '@omnivis/shared'

// ============================================================
// Next.js App Router 解析器
// ============================================================

export class NextjsAppParser implements Parser {
  readonly name = 'nextjs-app'

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 只有当前端框架是 Next.js 时才处理
    if (projectMeta.frontendFramework !== 'next') {
      return false
    }

    // 匹配 app/ 目录下的 page.tsx 或 route.ts
    const normalizedPath = filePath.replace(/\\/g, '/')
    return /(?:^|\/)app\/.*(?:page|route)\.(tsx|ts|jsx|js)$/.test(normalizedPath)
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

      // 判断是 page 还是 route
      if (/\/page\.(tsx|ts|jsx|js)$/.test(normalizedPath)) {
        const node = this.parsePage(normalizedPath, context.projectRoot)
        if (node) nodes.push(node)
      } else if (/\/route\.(tsx|ts|jsx|js)$/.test(normalizedPath)) {
        const node = this.parseRoute(normalizedPath, context.projectRoot)
        if (node) nodes.push(node)
      }
    } catch (err) {
      errors.push({
        file: filePath,
        message: `Next.js App Router parser failed: ${err instanceof Error ? err.message : String(err)}`,
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
    // 提取路由路径
    const route = this.extractRoute(filePath)

    // 获取行号
    const line = this.findComponentLine(filePath, projectRoot)

    // 检查是否是动态路由
    const isDynamic = /\[.*\]/.test(route)
    const params = this.extractParams(route)

    // 检查是否是路由组
    const isGroupLayout = /\(.*\)\//.test(filePath)

    const nodeId = createNodeId('page', filePath, route)

    const metadata: PageMetadata = {
      route,
      isDynamic,
      params,
      isGroupLayout,
      layoutFile: this.findLayoutFile(filePath, projectRoot),
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
  private parseRoute(filePath: string, projectRoot: string): OmniNode | null {
    // 提取路由路径
    const route = this.extractRoute(filePath)

    // 获取行号
    const line = this.findExportedFunctionLine(filePath, projectRoot)

    // 提取 HTTP methods
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
   * 从文件路径提取路由
   * app/booking/[id]/page.tsx → /booking/[id]
   */
  private extractRoute(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/')

    // 提取 app/ 之后的部分
    const appMatch = normalizedPath.match(/(?:^|\/)app\/(.*)$/)
    if (!appMatch) return '/'

    let routePath = appMatch[1]

    // 移除文件名（page.tsx, route.ts 等）
    routePath = routePath.replace(/\/(?:page|route|layout|loading|error)\.(tsx|ts|jsx|js)$/, '')

    // 处理路由组：(group) → 移除括号
    routePath = routePath.replace(/\(([^)]+)\)\//g, '$1/')

    // 处理 parallel routes：@slot → 移除 @
    routePath = routePath.replace(/@([^/]+)/g, '$1')

    // 处理默认路由
    if (routePath === '' || routePath === '.') {
      return '/'
    }

    // 确保以 / 开头
    return routePath.startsWith('/') ? routePath : `/${routePath}`
  }

  /**
   * 提取动态路由参数
   * /booking/[id] → ['id']
   * /booking/[...slug] → ['slug']
   */
  private extractParams(route: string): string[] {
    const params: string[] = []
    const paramPattern = /\[([^\]]+)\]/g
    let match

    while ((match = paramPattern.exec(route)) !== null) {
      const param = match[1]
      // 移除 ... 前缀（catch-all）
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
   * 查找导出函数的行号（用于 API Route）
   */
  private findExportedFunctionLine(filePath: string, projectRoot: string): number {
    try {
      const fullPath = path.resolve(projectRoot, filePath)
      if (!fs.existsSync(fullPath)) return 1

      const content = fs.readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')

      // 查找 export async function GET/POST/PUT/DELETE
      for (let i = 0; i < lines.length; i++) {
        if (/export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/.test(lines[i])) {
          return i + 1
        }
      }

      return 1
    } catch {
      return 1
    }
  }

  /**
   * 提取 HTTP methods
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

      return methods.length > 0 ? methods : ['GET']
    } catch {
      return ['GET']
    }
  }

  /**
   * 查找最近的 layout 文件
   */
  private findLayoutFile(filePath: string, projectRoot: string): string | null {
    const normalizedPath = filePath.replace(/\\/g, '/')
    const dir = path.dirname(normalizedPath)

    // 向上查找 layout.tsx
    let currentDir = dir
    while (currentDir && currentDir !== 'app') {
      const layoutPath = path.join(currentDir, 'layout.tsx')
      const fullPath = path.resolve(projectRoot, layoutPath)

      if (fs.existsSync(fullPath)) {
        return layoutPath
      }

      // 向上一级
      currentDir = path.dirname(currentDir)
    }

    return null
  }
}
