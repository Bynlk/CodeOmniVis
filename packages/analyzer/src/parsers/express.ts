/**
 * Express 路由解析器
 *
 * 识别 app.get/post/put/delete 调用和 router.xxx 调用。
 * 提取路由路径和 HTTP method。
 * 支持 router 级别的路由前缀。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, CallExpression, Node } from 'ts-morph'
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
} from '@omnivis/shared'
import { createNodeId } from '@omnivis/shared'

// ============================================================
// Express 路由解析器
// ============================================================

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const

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
        this.project = new Project({
          tsConfigFilePath: context.tsConfig?.options?.configFilePath as string,
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
  private findRouteDefinitions(sourceFile: any, filePath: string): OmniNode[] {
    const nodes: OmniNode[] = []
    const routerPrefix = this.detectRouterPrefix(sourceFile)

    sourceFile.forEachDescendant((node: any) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return

      const callExpr = node as CallExpression
      const expression = callExpr.getExpression()

      // 检查是否是 app.get/post/... 或 router.get/post/...
      const method = this.extractHttpMethod(expression)
      if (!method) return

      // 提取路由路径
      const routePath = this.extractRoutePath(callExpr)
      if (!routePath) return

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
   * 检测 router 前缀
   * 例如：const router = Router() 且 router 有 prefix
   */
  private detectRouterPrefix(sourceFile: any): string {
    let prefix = ''

    sourceFile.forEachDescendant((node: any) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return

      const callExpr = node as CallExpression
      const expression = callExpr.getExpression()

      // 检查 Router() 或 express.Router()
      if (Node.isIdentifier(expression)) {
        const name = expression.getText()
        if (name === 'Router') {
          // 查找这个 router 变量的使用，看是否有 prefix
          const parent = callExpr.getParent()
          if (parent && Node.isVariableDeclaration(parent)) {
            const varName = parent.getName()
            // 在文件中查找 router.use('/prefix', ...) 模式
            prefix = this.findRouterPrefix(sourceFile, varName)
          }
        }
      }
    })

    return prefix
  }

  /**
   * 查找 router 的前缀
   */
  private findRouterPrefix(sourceFile: any, routerName: string): string {
    let prefix = ''

    sourceFile.forEachDescendant((node: any) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return

      const callExpr = node as CallExpression
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
  private extractHttpMethod(expression: any): string | null {
    // app.get / router.get
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName()
      if (HTTP_METHODS.includes(methodName as any)) {
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
