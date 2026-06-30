/**
 * NestJS Controller 解析器
 *
 * 解析 @Controller('/prefix') 装饰器提取路由前缀。
 * 遍历方法的 HTTP 装饰器（@Get/@Post/@Put/@Delete/@Patch）。
 * 生成 api_route 节点和 handler 节点，以及 handles 边。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, Node, Decorator, ClassDeclaration, MethodDeclaration } from 'ts-morph'
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
  HandlerMetadata,
} from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'

// ============================================================
// 常量
// ============================================================

const HTTP_DECORATORS = new Set<string>(['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'])
const HTTP_METHOD_MAP: Record<string, string> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Delete: 'DELETE',
  Patch: 'PATCH',
  Options: 'OPTIONS',
  Head: 'HEAD',
}

// ============================================================
// NestJS Controller 解析器
// ============================================================

export class NestjsControllerParser implements Parser {
  readonly name = 'nestjs-controller'
  private project: Project | null = null

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.backendFramework !== 'nestjs') return false

    const normalizedPath = filePath.replace(/\\/g, '/')
    if (/__tests__|\.test\.|\.spec\.|node_modules/.test(normalizedPath)) return false

    // .controller.ts 文件或包含 @Controller 装饰器的文件
    if (/\.controller\.(ts|tsx)$/.test(normalizedPath)) return true
    if (/\/controllers?\//.test(normalizedPath)) return true

    return false
  }

  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      if (!this.project) {
          const configFilePath = context.tsConfig?.options?.configFilePath
        this.project = new Project({
            tsConfigFilePath: typeof configFilePath === 'string' ? configFilePath : undefined,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 查找所有 Controller 类
      const classes = sourceFile.getClasses()
      for (const cls of classes) {
        const controllerDecorator = this.findDecorator(cls, 'Controller')
        if (!controllerDecorator) continue

        // 提取路由前缀
        const prefix = this.extractControllerPrefix(controllerDecorator)

        // 解析方法上的 HTTP 装饰器
        for (const method of cls.getMethods()) {
          const httpDecorator = this.findHttpDecorator(method)
          if (!httpDecorator) continue

          const decoratorName = httpDecorator.getName()
          const httpMethod = HTTP_METHOD_MAP[decoratorName] ?? 'GET'
          const methodRoute = this.extractMethodRoute(httpDecorator) ?? '/'

          // 组合完整路由
          const fullRoute = this.combineRoutes(prefix, methodRoute)
          const methodName = method.getName()
          const line = method.getStartLineNumber()

          // 创建 api_route 节点
          const routeNodeId = createNodeId('api_route', filePath, `${httpMethod} ${fullRoute}`)
          const routeMetadata: ApiRouteMetadata = {
            method: httpMethod,
            route: fullRoute,
            isNextApiRoute: false,
          }
          nodes.push({
            id: routeNodeId,
            type: 'api_route',
            name: `${httpMethod} ${fullRoute}`,
            filePath,
            line,
            column: 1,
            metadata: routeMetadata,
          })

          // 创建 handler 节点
          const handlerNodeId = createNodeId('handler', filePath, methodName)
          const handlerMetadata: HandlerMetadata = {
            functionName: methodName,
            routeId: routeNodeId,
          }
          nodes.push({
            id: handlerNodeId,
            type: 'handler',
            name: methodName,
            filePath,
            line,
            column: 1,
            metadata: handlerMetadata,
          })

          // 创建 handles 边（route → handler）
          const edgeId = createEdgeId(routeNodeId, 'handles', handlerNodeId)
          edges.push({
            id: edgeId,
            source: routeNodeId,
            target: handlerNodeId,
            type: 'handles',
            confidence: 'certain',
            metadata: {},
          })
        }
      }

      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `NestJS controller parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 查找指定名称的装饰器
   */
  private findDecorator(node: ClassDeclaration, name: string): Decorator | undefined {
    return node.getDecorators().find((d: Decorator) => d.getName() === name)
  }

  /**
   * 查找方法上的 HTTP 装饰器
   */
  private findHttpDecorator(method: MethodDeclaration): Decorator | undefined {
    return method.getDecorators().find((d: Decorator) =>
      HTTP_DECORATORS.has(d.getName())
    )
  }

  /**
   * 从 @Controller('/prefix') 提取前缀
   */
  private extractControllerPrefix(decorator: Decorator): string {
    const args = decorator.getArguments()
    if (args.length === 0) return ''

    const firstArg = args[0]
    if (Node.isStringLiteral(firstArg)) {
      return firstArg.getLiteralValue()
    }

    return ''
  }

  /**
   * 从 @Get('/path') 提取方法路由
   */
  private extractMethodRoute(decorator: Decorator): string | null {
    const args = decorator.getArguments()
    if (args.length === 0) return null

    const firstArg = args[0]
    if (Node.isStringLiteral(firstArg)) {
      return firstArg.getLiteralValue()
    }

    return null
  }

  /**
   * 组合控制器前缀和方法路由
   */
  private combineRoutes(prefix: string, methodRoute: string): string {
    const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
    const cleanRoute = methodRoute.startsWith('/') ? methodRoute : `/${methodRoute}`

    if (!cleanPrefix && cleanRoute === '/') return '/'
    return `${cleanPrefix}${cleanRoute === '/' ? '' : cleanRoute}` || '/'
  }
}
