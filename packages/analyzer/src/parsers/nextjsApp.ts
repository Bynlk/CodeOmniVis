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
} from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'

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
        if (node) {
          nodes.push(node)
          // 轻量级：从页面提取组件渲染关系
          const componentEdges = this.extractPageRenders(normalizedPath, context.projectRoot, node.id)
          edges.push(...componentEdges)
        }
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

    // 处理路由组：(group)/ → 完全移除（路由组不影响 URL）
    routePath = routePath.replace(/\([^)]+\)\//g, '')
    // 末尾的路由组也剥离
    routePath = routePath.replace(/\([^)]+\)$/g, '')

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
   * 提取页面渲染的组件关系（renders 边）
   * 通过分析 import 和 JSX 元素构建 page → component 连接
   */
  private extractPageComponents(filePath: string, projectRoot: string, pageId: string): OmniEdge[] {
    const edges: OmniEdge[] = []

    try {
      const fullPath = path.resolve(projectRoot, filePath)
      if (!fs.existsSync(fullPath)) return edges

      const content = fs.readFileSync(fullPath, 'utf-8')

      // 构建 import 映射：组件名 → 文件路径
      const importMap = new Map<string, string>()
      const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g
      let match

      while ((match = importRegex.exec(content)) !== null) {
        const namedImports = match[1]
        const defaultImport = match[2]
        const importPath = match[3]

        // 只处理相对路径 import（避免昂贵的 workspace 解析）
        if (!importPath.startsWith('.')) continue

        const resolvedPath = this.resolveRelativeImport(filePath, importPath, projectRoot)
        if (!resolvedPath) continue

        if (namedImports) {
          for (const name of namedImports.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())) {
            if (name && /^[A-Z]/.test(name)) importMap.set(name, resolvedPath)
          }
        }
        if (defaultImport && /^[A-Z]/.test(defaultImport)) {
          importMap.set(defaultImport, resolvedPath)
        }
      }

      // 查找 JSX 元素
      const jsxRegex = /<([A-Z]\w*)(?:\s|\/|>)/g
      const usedComponents = new Set<string>()
      while ((match = jsxRegex.exec(content)) !== null) {
        const tagName = match[1]
        if (tagName && !['Fragment', 'Suspense', 'ErrorBoundary'].includes(tagName)) {
          usedComponents.add(tagName)
        }
      }

      // 创建 renders 边
      for (const componentName of usedComponents) {
        const componentPath = importMap.get(componentName)
        if (componentPath) {
          const componentId = createNodeId('component', componentPath, componentName)
          const edgeId = createEdgeId(pageId, 'renders', componentId)
          edges.push({
            id: edgeId,
            source: pageId,
            target: componentId,
            type: 'renders',
            confidence: 'certain',
            metadata: { jsxLine: 0 },
          })
        }
      }
    } catch {
      // 降级
    }

    return edges
  }

  /**
   * 解析相对路径 import
   */
  private resolveRelativeImport(fromFile: string, importPath: string, projectRoot: string): string | null {
    try {
      const fromDir = path.dirname(fromFile)
      const resolved = path.join(fromDir, importPath).replace(/\\/g, '/')

      const exts = ['.tsx', '.ts', '.jsx', '.js']
      for (const ext of exts) {
        const candidate = resolved + ext
        if (fs.existsSync(path.resolve(projectRoot, candidate))) return candidate
      }
      for (const ext of exts) {
        const indexPath = path.join(resolved, 'index' + ext)
        if (fs.existsSync(path.resolve(projectRoot, indexPath))) return indexPath
      }

      return resolved
    } catch {
      return null
    }
  }

  /**
   * 轻量级提取页面渲染的组件关系
   * 支持相对路径、path alias（@lib/、app/、~/）
   */
  private extractPageRenders(filePath: string, projectRoot: string, pageId: string): OmniEdge[] {
    const edges: OmniEdge[] = []
    try {
      const fullPath = path.resolve(projectRoot, filePath)
      if (!fs.existsSync(fullPath)) return edges
      const content = fs.readFileSync(fullPath, 'utf-8')

      // 解析 import：组件名 → 文件路径
      const importMap = new Map<string, string>()
      const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g
      let m: RegExpExecArray | null

      while ((m = importRegex.exec(content)) !== null) {
        const named = m[1]
        const def = m[2]
        const importPath = m[3]

        // 只处理相对路径和 path alias（跳过 node_modules 包）
        if (importPath.startsWith('.') || importPath.startsWith('~/') ||
            importPath.startsWith('@lib/') || importPath.startsWith('app/')) {
          const resolved = this.resolveImportPath(filePath, importPath, projectRoot)
          if (!resolved) continue

          if (named) {
            for (const n of named.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())) {
              if (n && /^[A-Z]/.test(n)) importMap.set(n, resolved)
            }
          }
          if (def && /^[A-Z]/.test(def)) importMap.set(def, resolved)
        }
      }

      // 查找 JSX 使用
      const jsxRegex = /<([A-Z]\w*)(?:[\s/>])/g
      while ((m = jsxRegex.exec(content)) !== null) {
        const tag = m[1]
        const compPath = importMap.get(tag)
        if (compPath) {
          const compId = createNodeId('component', compPath, tag)
          edges.push({
            id: createEdgeId(pageId, 'renders', compId),
            source: pageId,
            target: compId,
            type: 'renders',
            confidence: 'certain',
            metadata: { jsxLine: 0 },
          })
        }
      }
    } catch { /* 降级 */ }
    return edges
  }

  /**
   * 解析 import 路径（支持相对路径和 path alias）
   */
  private resolveImportPath(fromFile: string, importPath: string, projectRoot: string): string | null {
    try {
      let resolved: string

      if (importPath.startsWith('.')) {
        // 相对路径
        resolved = path.join(path.dirname(fromFile), importPath).replace(/\\/g, '/')
      } else if (importPath.startsWith('~/')) {
        // ~/ 别名 → 相对于 apps/web
        resolved = importPath.replace(/^~\//, '').replace(/\\/g, '/')
      } else if (importPath.startsWith('@lib/')) {
        // @lib/ 别名 → lib/
        resolved = importPath.replace(/^@lib\//, 'lib/').replace(/\\/g, '/')
      } else if (importPath.startsWith('app/')) {
        // app/ 路径别名
        resolved = importPath.replace(/\\/g, '/')
      } else {
        return null
      }

      // 补全扩展名
      const exts = ['.tsx', '.ts', '.jsx', '.js']
      for (const ext of exts) {
        if (fs.existsSync(path.resolve(projectRoot, resolved + ext))) return resolved + ext
      }
      for (const ext of exts) {
        const idx = path.join(resolved, 'index' + ext)
        if (fs.existsSync(path.resolve(projectRoot, idx))) return idx
      }
      return null
    } catch { return null }
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
    return findLayoutFileBounded(filePath, projectRoot, (full) => fs.existsSync(full))
  }
}

/** layout 向上查找的层数上限,防止异常路径下无界递归。 */
const MAX_LAYOUT_LOOKUP_DEPTH = 64

/**
 * 从页面文件向上逐级查找最近的 `layout.tsx`(H5 · BOUND-02)。
 *
 * 终止条件:命中 layout、到达相对路径顶端(`.`)、或超出最大层数上限。
 * `exists` 谓词以「相对仓库根的 layout 路径解析后的绝对路径」为入参,便于注入测试。
 *
 * @param filePath 相对仓库根的页面文件路径。
 * @param projectRoot 仓库根绝对路径。
 * @param exists 判断给定绝对路径是否存在的谓词。
 * @returns 命中的相对 layout 路径;未命中返回 null。
 */
export function findLayoutFileBounded(
  filePath: string,
  projectRoot: string,
  exists: (fullPath: string) => boolean,
): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/')
  let currentDir = path.dirname(normalizedPath)

  for (let depth = 0; depth < MAX_LAYOUT_LOOKUP_DEPTH; depth += 1) {
    const layoutPath = path.join(currentDir, 'layout.tsx')
    const fullPath = path.resolve(projectRoot, layoutPath)
    if (exists(fullPath)) {
      return layoutPath
    }

    const parent = path.dirname(currentDir)
    // 到达相对路径顶端('.' 或绝对根)即停,避免 dirname 自循环导致无界递归。
    if (parent === currentDir || currentDir === '.' || currentDir === '') {
      break
    }
    currentDir = parent
  }

  return null
}
