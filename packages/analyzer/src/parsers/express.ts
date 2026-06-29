/**
 * Express 路由解析器
 *
 * 识别 app.get/post/put/delete 调用和 router.xxx 调用。
 * 提取路由路径和 HTTP method。
 * 支持 router 级别的路由前缀。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, CallExpression, Node, SourceFile } from 'ts-morph'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  OmniEdge,
  ProjectMeta,
  ApiRouteMetadata,
} from '@codeomnivis/shared'
import { createNodeId } from '@codeomnivis/shared'

// ============================================================
// Express 路由解析器
// ============================================================

const HTTP_METHODS = new Set<string>(['get', 'post', 'put', 'delete', 'patch'])

export class ExpressParser implements Parser {
  readonly name = 'express'
  private project: Project | null = null

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 只有当后端框架是 Express 时才处理
    if (projectMeta.backendFramework !== 'express') {
      return false
    }

    const normalizedPath = filePath.replace(/\\/g, '/')

    // 排除测试文件和 node_modules
    if (/__tests__|\.test\.|\.spec\.|node_modules/.test(normalizedPath)) {
      return false
    }

    // 路径包含 routes/ 目录
    if (/\/routes\//.test(normalizedPath)) {
      return true
    }

    // 文件名包含 route 或 routes
    if (/\/routes?\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      return true
    }

    // 文件名包含 router
    if (/\/router\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      return true
    }

    return false
  }

  /**
   * 执行解析
   */
  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      // 初始化 ts-morph Project
      if (!this.project) {
          const configFilePath = context.tsConfig?.options?.configFilePath
        this.project = new Project({
            tsConfigFilePath: typeof configFilePath === 'string' ? configFilePath : undefined,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 查找路由定义
      const routes = this.findRouteDefinitions(sourceFile, filePath)

      nodes.push(...routes)

      // 移除源文件以释放内存
      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `Express parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 查找路由定义
   */
  private findRouteDefinitions(sourceFile: SourceFile, filePath: string): OmniNode[] {
    const nodes: OmniNode[] = []
    // 为每个 router 变量维护独立的前缀
    const routerPrefixes = this.detectAllRouterPrefixes(sourceFile)

    sourceFile.forEachDescendant((node: Node) => {
      if (!Node.isCallExpression(node)) return

      const callExpr = node
      const expression = callExpr.getExpression()

      // 检查是否是 app.get/post/... 或 router.get/post/...
      const method = this.extractHttpMethod(expression)
      if (!method) return

      // 提取路由路径
      const routePath = this.extractRoutePath(callExpr)
      if (!routePath) return

      // 获取该调用所属 router 的前缀
      const routerName = this.getRouterName(expression)
      const routerPrefix = routerName ? (routerPrefixes.get(routerName) ?? '') : ''

      // 组合完整路径
      const fullPath = routerPrefix
        ? `${routerPrefix}${routePath === '/' ? '' : routePath}`
        : routePath

      const nodeId = createNodeId('api_route', filePath, fullPath)
      const line = callExpr.getStartLineNumber()

      const metadata: ApiRouteMetadata = {
        method: method.toUpperCase(),
        route: fullPath,
        isNextApiRoute: false,
      }

      nodes.push({
        id: nodeId,
        type: 'api_route',
        name: fullPath,
        filePath,
        line,
        column: 1,
        metadata,
      })
    })

    return nodes
  }

  /**
   * 检测所有 router 的前缀
   * 返回 routerName -> prefix 的映射
   */
  private detectAllRouterPrefixes(sourceFile: SourceFile): Map<string, string> {
    const prefixes = new Map<string, string>()

    sourceFile.forEachDescendant((node: Node) => {
      if (!Node.isCallExpression(node)) return

      const callExpr = node
      const expression = callExpr.getExpression()

      // 检查 Router() 或 express.Router()
      if (Node.isIdentifier(expression)) {
        const name = expression.getText()
        if (name === 'Router') {
          const parent = callExpr.getParent()
          if (parent && Node.isVariableDeclaration(parent)) {
            const varName = parent.getName()
            const prefix = this.findRouterPrefix(sourceFile, varName)
            prefixes.set(varName, prefix)
          }
        }
      }
    })

    return prefixes
  }

  /**
   * 从表达式中获取 router 变量名
   */
  private getRouterName(expression: Node): string | null {
    if (Node.isPropertyAccessExpression(expression)) {
      const obj = expression.getExpression()
      if (Node.isIdentifier(obj)) {
        return obj.getText()
      }
    }
    return null
  }

  /**
   * 查找 router 的前缀
   */
  private findRouterPrefix(sourceFile: SourceFile, routerName: string): string {
    let prefix = ''

    sourceFile.forEachDescendant((node: Node) => {
      if (!Node.isCallExpression(node)) return

      const callExpr = node
      const expression = callExpr.getExpression()

      // 检查 router.use('/prefix', ...)
      if (Node.isPropertyAccessExpression(expression)) {
        const obj = expression.getExpression()
        const method = expression.getName()

        if (Node.isIdentifier(obj) && obj.getText() === routerName && method === 'use') {
          const args = callExpr.getArguments()
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            prefix = args[0].getLiteralValue()
          }
        }
      }
    })

    return prefix
  }

  /**
   * 从表达式中提取 HTTP method
   */
  private extractHttpMethod(expression: Node): string | null {
    // app.get / router.get
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName()
        if (HTTP_METHODS.has(methodName)) {
        return methodName
      }
    }

    return null
  }

  /**
   * 从调用表达式中提取路由路径
   */
  private extractRoutePath(call: CallExpression): string | null {
    const args = call.getArguments()
    if (args.length === 0) return null

    const firstArg = args[0]

    // 字符串字面量
    if (Node.isStringLiteral(firstArg)) {
      return firstArg.getLiteralValue()
    }

    // 模板字符串（简单情况）
    if (Node.isTemplateExpression(firstArg)) {
      // 将 ${...} 替换为 :param
      const text = firstArg.getText()
      return text.replace(/\$\{[^}]+\}/g, ':param')
    }

    return null
  }
}
