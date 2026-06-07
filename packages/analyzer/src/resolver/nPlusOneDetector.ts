/**
 * N+1 查询静态检测器
 *
 * 检测循环体内的 DB 调用模式：
 * - for (const x of items) { await prisma.xxx.findMany() }
 * - items.forEach(async (x) => { await db.xxx.create() })
 * - items.map(async (x) => { await prisma.xxx.update() })
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, Node, type CallExpression, type SourceFile } from 'ts-morph'
import * as fs from 'fs'
import * as path from 'path'
import type { OmniGraph, OmniNode, Issue, IssueLocation } from '@codeomnivis/shared'

// DB 调用模式（与 SymbolResolver.extractDbCall 一致）
const PRISMA_PATTERN = /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)/
const TYPEORM_REPO_PATTERN = /this\.(\w+?)(?:Repository|Repo)\.(save|find|findOne|findOneBy|findBy|update|delete|remove|count|insert|exist)/i
const TYPEORM_EM_PATTERN = /this\.entityManager\.(save|find|findOne|remove|update|delete)/

interface DbCallInfo {
  modelName: string
  operation: string
  line: number
  exprText: string
}

// ============================================================
// N+1 检测器
// ============================================================

export class NPlusOneDetector {
  private project: Project | null = null

  /**
   * 检测图中所有 handler/service 节点的 N+1 查询
   */
  detect(graph: OmniGraph, projectRoot: string): Issue[] {
    const issues: Issue[] = []

    // 只检测 handler 和 service 节点
    const targetNodes = graph.nodes.filter(n =>
      n.type === 'handler' || n.type === 'service'
    )

    // 按文件分组，避免重复解析同一文件
    const byFile = new Map<string, OmniNode[]>()
    for (const node of targetNodes) {
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
        const fileIssues = this.analyzeFile(fullPath, nodes)
        issues.push(...fileIssues)
      } catch {
        // 降级：单文件分析失败不影响整体
      }
    }

    return issues
  }

  /**
   * 分析单个文件中的 N+1 模式（扫描整个文件）
   */
  private analyzeFile(fullPath: string, nodes: OmniNode[]): Issue[] {
    const issues: Issue[] = []

    if (!this.project) {
      this.project = new Project({
        skipAddingFilesFromTsConfig: true,
      })
    }

    let sourceFile: SourceFile
    try {
      sourceFile = this.project.addSourceFileAtPath(fullPath)
    } catch {
      return issues
    }

    // 扫描整个文件的循环内 DB 调用
    const nPlusOneCalls = this.findDbCallsInLoops(sourceFile)

    // 为每个发现创建 Issue（关联到文件中的第一个 handler/service 节点）
    const targetNode = nodes[0]
    if (targetNode && nPlusOneCalls.length > 0) {
      for (const { loopNode, dbCall, loopType } of nPlusOneCalls) {
        issues.push(this.createIssue(targetNode, loopNode, dbCall, loopType))
      }
    }

    // 释放内存
    this.project.removeSourceFile(sourceFile)

    return issues
  }

  /**
   * 查找节点对应的函数
   */
  private findFunction(sourceFile: SourceFile, node: OmniNode): Node | null {
    // 按行号查找
    const targetLine = node.line

    // 查找包含目标行号的函数
    const functions = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    for (const fn of functions) {
      if (fn.getStartLineNumber() <= targetLine && fn.getEndLineNumber() >= targetLine) {
        return fn
      }
    }

    // 箭头函数
    const arrowFns = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)
    for (const fn of arrowFns) {
      if (fn.getStartLineNumber() <= targetLine && fn.getEndLineNumber() >= targetLine) {
        return fn
      }
    }

    // 方法声明
    const methods = sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)
    for (const fn of methods) {
      if (fn.getStartLineNumber() <= targetLine && fn.getEndLineNumber() >= targetLine) {
        return fn
      }
    }

    return null
  }

  /**
   * 检测函数体内循环内的 DB 调用
   */
  private findDbCallsInLoops(fn: Node): Array<{ loopNode: Node; dbCall: DbCallInfo; loopType: string }> {
    const results: Array<{ loopNode: Node; dbCall: DbCallInfo; loopType: string }> = []

    // 1. for-of / for-in / for 循环
    const forOfLoops = fn.getDescendantsOfKind(SyntaxKind.ForOfStatement)
    const forInLoops = fn.getDescendantsOfKind(SyntaxKind.ForInStatement)
    const forLoops = fn.getDescendantsOfKind(SyntaxKind.ForStatement)

    for (const loop of [...forOfLoops, ...forInLoops, ...forLoops]) {
      const dbCalls = this.findDbCallsInNode(loop)
      for (const dbCall of dbCalls) {
        results.push({ loopNode: loop, dbCall, loopType: 'for' })
      }
    }

    // 2. .forEach() / .map() / .flatMap() 调用
    const callExprs = fn.getDescendantsOfKind(SyntaxKind.CallExpression)
    for (const call of callExprs) {
      const methodName = this.getCallMethodName(call)
      if (['forEach', 'map', 'flatMap'].includes(methodName)) {
        // 检查回调函数体内的 DB 调用
        const args = call.getArguments()
        for (const arg of args) {
          if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
            const dbCalls = this.findDbCallsInNode(arg)
            for (const dbCall of dbCalls) {
              results.push({ loopNode: call, dbCall, loopType: methodName })
            }
          }
        }
      }
    }

    return results
  }

  /**
   * 在节点内查找 DB 调用
   */
  private findDbCallsInNode(node: Node): DbCallInfo[] {
    const results: DbCallInfo[] = []
    const callExprs = node.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExprs) {
      const dbCall = this.extractDbCall(call)
      if (dbCall) {
        // 检查是否在 await 表达式内（同步调用不算 N+1）
        const parent = call.getParent()
        if (parent && parent.getKind() === SyntaxKind.AwaitExpression) {
          results.push(dbCall)
        }
      }
    }

    return results
  }

  /**
   * 提取 DB 调用信息（复用 SymbolResolver 的模式）
   */
  private extractDbCall(callExpr: CallExpression): DbCallInfo | null {
    const exprText = callExpr.getExpression().getText()

    // Prisma
    const prismaMatch = exprText.match(PRISMA_PATTERN)
    if (prismaMatch) {
      return {
        modelName: this.capitalize(prismaMatch[1]),
        operation: prismaMatch[2],
        line: callExpr.getStartLineNumber(),
        exprText,
      }
    }

    // TypeORM Repository
    const typeormMatch = exprText.match(TYPEORM_REPO_PATTERN)
    if (typeormMatch) {
      return {
        modelName: this.capitalize(typeormMatch[1]),
        operation: typeormMatch[2],
        line: callExpr.getStartLineNumber(),
        exprText,
      }
    }

    // TypeORM EntityManager
    const emMatch = exprText.match(TYPEORM_EM_PATTERN)
    if (emMatch) {
      return {
        modelName: 'Entity',
        operation: emMatch[1],
        line: callExpr.getStartLineNumber(),
        exprText,
      }
    }

    return null
  }

  /**
   * 获取方法调用的方法名
   */
  private getCallMethodName(call: CallExpression): string {
    const expr = call.getExpression()
    if (Node.isPropertyAccessExpression(expr)) {
      return expr.getName()
    }
    return ''
  }

  /**
   * 创建 N+1 Issue
   */
  private createIssue(
    handlerNode: OmniNode,
    loopNode: Node,
    dbCall: DbCallInfo,
    loopType: string
  ): Issue {
    const loopLine = loopNode.getStartLineNumber()
    const filePath = handlerNode.filePath

    return {
      id: `n1-${handlerNode.id}-${dbCall.line}`,
      type: 'n_plus_one_query',
      severity: 'critical',
      description: `N+1 query: prisma.${dbCall.modelName}.${dbCall.operation}() inside ${loopType} loop`,
      locations: [
        { file: filePath, line: loopLine, note: `${loopType} loop starts here` },
        { file: filePath, line: dbCall.line, note: `DB call: ${dbCall.exprText}` },
      ],
      relatedNodeIds: [handlerNode.id],
      relatedEdgeIds: [],
    }
  }

  /**
   * 解析文件路径（支持 monorepo 子目录）
   */
  private resolveFilePath(filePath: string, projectRoot: string): string | null {
    // 尝试直接解析
    const direct = path.resolve(projectRoot, filePath)
    if (fs.existsSync(direct)) return direct

    // 尝试 apps/web/ 子目录
    const appsWeb = path.resolve(projectRoot, 'apps', 'web', filePath)
    if (fs.existsSync(appsWeb)) return appsWeb

    // 尝试 src/ 子目录
    const srcDir = path.resolve(projectRoot, 'src', filePath)
    if (fs.existsSync(srcDir)) return srcDir

    return null
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
