/**
 * tRPC Router 解析器
 *
 * 使用 ts-morph 解析 createTRPCRouter 调用。
 * 递归解析嵌套 router，提取 procedure 类型。
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
  TrpcProcedureMetadata,
} from '@omnivis/shared'
import { createNodeId, createEdgeId } from '@omnivis/shared'

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
        this.project = new Project({
          tsConfigFilePath: context.tsConfig?.options?.configFilePath as string,
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
          }

          // 解析 procedures
          const procedureNodes = this.parseProcedures(call, filePath)
          nodes.push(...procedureNodes)
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
  private findCreateRouterCalls(sourceFile: any): CallExpression[] {
    const calls: CallExpression[] = []

    // 递归查找所有函数调用
    sourceFile.forEachDescendant((node: any) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node as CallExpression
        const expression = callExpr.getExpression()

        // 检查是否是 createTRPCRouter(...) 或类似调用
        if (Node.isIdentifier(expression)) {
          const name = expression.getText()
          if (name === 'createTRPCRouter' || name === 'createRouter' || name === 'router') {
            calls.push(callExpr)
          }
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
      },
    }
  }

  /**
   * 解析 procedures
   */
  private parseProcedures(call: CallExpression, filePath: string): OmniNode[] {
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
                  routerName: 'unknown',
                  procedureName,
                  hasInput: this.hasInputSchema(initializer),
                  hasOutput: false,
                },
              })
            }
          }
        })
      }
    }

    return nodes
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
    const args = call.getArguments()

    for (const arg of args) {
      if (Node.isObjectLiteralExpression(arg)) {
        const inputProp = arg.getProperty('input')
        return !!inputProp
      }
    }

    return false
  }
}
