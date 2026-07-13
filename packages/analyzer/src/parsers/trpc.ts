/**
 * tRPC Router 解析器
 *
 * 使用 ts-morph 解析 createTRPCRouter 调用。
 * 递归解析嵌套 router，提取 procedure 类型。
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
} from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'

// ============================================================
// tRPC 解析器
// ============================================================

export class TrpcParser implements Parser {
  readonly name = 'trpc'
  private project: Project | null = null

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 只有当后端框架是 tRPC 时才处理
    if (projectMeta.backendFramework !== 'trpc') {
      return false
    }

    const normalizedPath = filePath.replace(/\\/g, '/')

    // 文件名包含 router
    if (/router\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      return true
    }

    // 路径包含 routers/（tRPC routers 目录）
    if (/\/routers\//.test(normalizedPath)) {
      return true
    }

    // 路径包含 trpc
    if (/\/trpc\//.test(normalizedPath)) {
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

      // 查找 createTRPCRouter 调用
      const routerCalls = this.findCreateRouterCalls(sourceFile)

      for (const call of routerCalls) {
        try {
          const routerNode = this.parseRouterCall(call, filePath)
          if (routerNode) {
            nodes.push(routerNode)

            // 解析 procedures
            const procedureNodes = this.parseProcedures(
              call,
              filePath,
              this.normalizeRouterName(routerNode.name),
            )
            nodes.push(...procedureNodes)

            // 创建 router → procedure 的 contains 边
            for (const procNode of procedureNodes) {
              const edgeId = createEdgeId(routerNode.id, 'contains', procNode.id)
              edges.push({
                id: edgeId,
                source: routerNode.id,
                target: procNode.id,
                type: 'contains',
                confidence: 'certain',
                metadata: {
                  routerName: routerNode.name,
                  procedureName: procNode.name,
                },
              })
            }
          }
        } catch (err) {
          errors.push({
            file: filePath,
            message: `Failed to parse tRPC router: ${err instanceof Error ? err.message : String(err)}`,
            severity: 'warning',
          })
        }
      }

      // 移除源文件以释放内存
      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `tRPC parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 查找 createTRPCRouter 调用
   */
  private findCreateRouterCalls(sourceFile: SourceFile): CallExpression[] {
    const calls: CallExpression[] = []

    // 递归查找所有函数调用
    sourceFile.forEachDescendant((node: Node) => {
      if (!Node.isCallExpression(node)) return
      const callExpr = node
        const expression = callExpr.getExpression()

        // 检查是否是 createTRPCRouter(...) 或类似调用
        if (Node.isIdentifier(expression)) {
          const name = expression.getText()
          if (name === 'createTRPCRouter' || name === 'createRouter' || name === 'router') {
            calls.push(callExpr)
        }
      }
    })

    return calls
  }

  /**
   * 解析 router 调用
   */
  private parseRouterCall(call: CallExpression, filePath: string): OmniNode | null {
    // 获取 router 名称（从变量声明）
    const parent = call.getParent()
    let routerName = 'unknown'

    if (Node.isVariableDeclaration(parent)) {
      routerName = parent.getName()
    } else if (Node.isPropertyAssignment(parent)) {
      routerName = parent.getName()
    }

    const line = call.getStartLineNumber()
    const nodeId = createNodeId('trpc_procedure', filePath, routerName)

    return {
      id: nodeId,
      type: 'trpc_procedure',
      name: routerName,
      filePath,
      line,
      column: 1,
      metadata: {
        procedureType: 'query', // 默认类型
        routerName,
        procedureName: routerName,
        hasInput: false,
        hasOutput: false,
        isRouter: true,
      },
    }
  }

  /**
   * 解析 procedures
   */
  private parseProcedures(call: CallExpression, filePath: string, routerName: string): OmniNode[] {
    const nodes: OmniNode[] = []

    // 获取参数（通常是对象字面量）
    const args = call.getArguments()

    for (const arg of args) {
      if (Node.isObjectLiteralExpression(arg)) {
        // 遍历对象属性
        arg.getProperties().forEach((prop) => {
          if (Node.isPropertyAssignment(prop)) {
            const procedureName = prop.getName()
            const initializer = prop.getInitializer()

            if (initializer && Node.isCallExpression(initializer)) {
              const procedureType = this.detectProcedureType(initializer)
              const line = prop.getStartLineNumber()

              const nodeId = createNodeId('trpc_procedure', filePath, procedureName)

              nodes.push({
                id: nodeId,
                type: 'trpc_procedure',
                name: procedureName,
                filePath,
                line,
                column: 1,
                metadata: {
                  procedureType,
                  routerName,
                  procedureName,
                  hasInput: this.hasInputSchema(initializer),
                  hasOutput: this.hasOutputSchema(initializer),
                },
              })
            }
          }
        })
      }
    }

    return nodes
  }

  private normalizeRouterName(declarationName: string): string {
    const normalized = declarationName.replace(/Router$/, '')
    return normalized.length > 0 ? normalized : declarationName
  }

  /**
   * 检测 procedure 类型
   */
  private detectProcedureType(call: CallExpression): 'query' | 'mutation' | 'subscription' {
    const expression = call.getExpression()
    const text = expression.getText()

    if (text.includes('mutation')) return 'mutation'
    if (text.includes('subscription')) return 'subscription'
    return 'query'
  }

  /**
   * 检查是否有 input schema
   */
  private hasInputSchema(call: CallExpression): boolean {
    return this.hasChainedMethod(call, 'input')
  }

  private hasOutputSchema(call: CallExpression): boolean {
    return this.hasChainedMethod(call, 'output')
  }

  private hasChainedMethod(call: CallExpression, methodName: 'input' | 'output'): boolean {
    return new RegExp(`\\.${methodName}\\s*\\(`).test(call.getExpression().getText())
  }
}
