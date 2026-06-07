/**
 * 符号解析器
 *
 * 使用 ts-morph 的类型系统跨文件追踪函数调用链。
 * 从 handler 节点追踪到它最终操作的所有 DB 模型。
 *
 * 遵循"降级而非崩溃"原则。
 */

import {
  Project,
  SourceFile,
  Node,
  SyntaxKind,
  CallExpression,
  FunctionDeclaration,
  ArrowFunction,
  MethodDeclaration,
  FunctionExpression,
} from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'
import type { OmniNode } from '@codeomnivis/shared'

// ============================================================
// 类型定义
// ============================================================

export interface DbCall {
  modelName: string
  operation: string
  filePath: string
  line: number
  confidence: 'certain' | 'inferred'
}

export interface TraceResult {
  dbCalls: DbCall[]
  callChain: string[]
  errors: string[]
}

type FunctionLike =
  | FunctionDeclaration
  | ArrowFunction
  | MethodDeclaration
  | FunctionExpression

// ============================================================
// 符号解析器
// ============================================================

export class SymbolResolver {
  private project: Project
  private visited = new Set<string>()
  private traceCache = new Map<string, TraceResult>()
  private MAX_DEPTH = 5

  constructor(tsConfigPath: string) {
    if (!fs.existsSync(tsConfigPath)) {
      throw new Error(`tsconfig not found: ${tsConfigPath}`)
    }
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: false,
      compilerOptions: {
        skipLibCheck: true,
        noEmit: true,
      },
    })
  }

  // ── 公共入口 ──────────────────────────────────

  /**
   * 给定一个 handler 节点，追踪到它最终操作的所有 DB 模型
   * 带超时保护和结果缓存
   */
  async traceHandlerToDb(
    handlerNode: OmniNode,
    timeoutMs = 5000
  ): Promise<TraceResult> {
    // 缓存
    const cacheKey = handlerNode.id
    if (this.traceCache.has(cacheKey)) {
      return this.traceCache.get(cacheKey)!
    }

    // 超时保护
    const result = await Promise.race([
      this._doTrace(handlerNode),
      new Promise<TraceResult>((resolve) =>
        setTimeout(() => resolve({
          dbCalls: [],
          callChain: [],
          errors: [`Timeout after ${timeoutMs}ms for ${handlerNode.id}`],
        }), timeoutMs)
      ),
    ])

    this.traceCache.set(cacheKey, result)
    return result
  }

  private async _doTrace(handlerNode: OmniNode): Promise<TraceResult> {
    this.visited.clear()

    const fn = this.findFunctionByNode(handlerNode)
    if (!fn) {
      return {
        dbCalls: [],
        callChain: [],
        errors: [`Cannot find function for node ${handlerNode.id}`],
      }
    }

    return this.traceFunction(fn, handlerNode.id, 0)
  }

  // ── 核心递归追踪 ──────────────────────────────

  private traceFunction(
    fn: FunctionLike,
    currentNodeId: string,
    depth: number
  ): TraceResult {
    const result: TraceResult = { dbCalls: [], callChain: [currentNodeId], errors: [] }

    if (depth >= this.MAX_DEPTH) {
      result.errors.push(`Max depth ${this.MAX_DEPTH} reached at ${currentNodeId}`)
      return result
    }

    const visitKey = this.getFunctionKey(fn)
    if (this.visited.has(visitKey)) {
      return result
    }
    this.visited.add(visitKey)

    const callExprs = fn.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const callExpr of callExprs) {
      // ① 先检查是否是终态的 Prisma / TypeORM 调用
      const dbCall = this.extractDbCall(callExpr)
      if (dbCall) {
        result.dbCalls.push(dbCall)
        continue
      }

      // ② 尝试解析 callee 到函数定义，递归追踪
      if (depth < this.MAX_DEPTH - 1) {
        const calleeFn = this.resolveCallee(callExpr)
        if (calleeFn) {
          const calleeNodeId = this.buildServiceNodeId(calleeFn)

          const sub = this.traceFunction(calleeFn, calleeNodeId, depth + 1)
          result.dbCalls.push(...sub.dbCalls)
          result.callChain.push(...sub.callChain)
          result.errors.push(...sub.errors)
        }
      }
    }

    return result
  }

  // ── Callee 解析 ───────────────────────────────

  private resolveCallee(callExpr: CallExpression): FunctionLike | null {
    try {
      const expr = callExpr.getExpression()

      // 尝试通过 TypeScript 类型系统找到定义
      const definitions = expr.getType()
        ?.getCallSignatures()
        .flatMap(sig => sig.getDeclaration() ? [sig.getDeclaration()!] : [])

      if (definitions && definitions.length > 0) {
        const def = definitions[0]
        if (this.isFunctionLike(def)) {
          const srcFile = def.getSourceFile().getFilePath()
          if (!srcFile.includes('node_modules')) {
            return def as FunctionLike
          }
        }
      }

      // fallback：通过符号查找
      const symbol = expr.getType().getSymbol()
        ?? expr.getType().getAliasSymbol()

      if (!symbol) return null

      const decls = symbol.getDeclarations()
      for (const decl of decls) {
        if (this.isFunctionLike(decl)) {
          const srcFile = decl.getSourceFile().getFilePath()
          if (!srcFile.includes('node_modules')) {
            return decl as FunctionLike
          }
        }
      }
    } catch {
      // 类型解析失败：静默返回 null
    }
    return null
  }

  // ── DB 调用检测 ───────────────────────────────

  private extractDbCall(callExpr: CallExpression): DbCall | null {
    const exprText = callExpr.getExpression().getText()

    // Prisma 调用模式
    const prismaMatch = exprText.match(
      /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)$/
    )
    if (prismaMatch) {
      return {
        modelName: capitalize(prismaMatch[1]),
        operation: prismaMatch[2],
        filePath: callExpr.getSourceFile().getFilePath(),
        line: callExpr.getStartLineNumber(),
        confidence: 'certain',
      }
    }

    // TypeORM Repository 调用
    const typeormMatch = exprText.match(
      /this\.(\w+?)(?:Repository|Repo)\.(save|find|findOne|findOneBy|findBy|update|delete|remove|count|insert|exist)$/i
    )
    if (typeormMatch) {
      return {
        modelName: capitalize(typeormMatch[1]),
        operation: typeormMatch[2],
        filePath: callExpr.getSourceFile().getFilePath(),
        line: callExpr.getStartLineNumber(),
        confidence: 'certain',
      }
    }

    // TypeORM EntityManager
    const emMatch = exprText.match(
      /this\.entityManager\.(save|find|findOne|remove|update|delete)/
    )
    if (emMatch) {
      const args = callExpr.getArguments()
      if (args.length > 0) {
        const entityName = args[0].getText()
        if (/^[A-Z]/.test(entityName)) {
          return {
            modelName: entityName,
            operation: emMatch[1],
            filePath: callExpr.getSourceFile().getFilePath(),
            line: callExpr.getStartLineNumber(),
            confidence: 'inferred',
          }
        }
      }
    }

    return null
  }

  // ── 工具方法 ──────────────────────────────────

  private findFunctionByNode(node: OmniNode): FunctionLike | null {
    try {
      const sourceFile = this.project.getSourceFile(node.filePath)
        ?? this.project.addSourceFileAtPath(node.filePath)

      if (!sourceFile) return null

      // 策略1：按行号定位
      if (node.line > 0) {
        const fn = this.findFunctionAtLine(sourceFile, node.line)
        if (fn) return fn
      }

      // 策略2：按函数名定位
      const name = this.extractFunctionName(node)
      if (name) {
        return this.findFunctionByName(sourceFile, name)
      }
    } catch {
      // 文件加载失败，返回 null
    }
    return null
  }

  private findFunctionAtLine(
    sourceFile: SourceFile,
    targetLine: number
  ): FunctionLike | null {
    const all: FunctionLike[] = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ]

    return all.find(fn => {
      const start = fn.getStartLineNumber()
      const end = fn.getEndLineNumber()
      return targetLine >= start && targetLine <= end
    }) ?? null
  }

  private findFunctionByName(
    sourceFile: SourceFile,
    name: string
  ): FunctionLike | null {
    const named = sourceFile.getFunction(name)
    if (named) return named

    const varDecl = sourceFile.getVariableDeclaration(name)
    if (varDecl) {
      const init = varDecl.getInitializer()
      if (init && Node.isArrowFunction(init)) return init
      if (init && Node.isFunctionExpression(init)) return init
    }

    for (const cls of sourceFile.getClasses()) {
      const method = cls.getMethod(name)
      if (method) return method
    }

    return null
  }

  private extractFunctionName(node: OmniNode): string | null {
    const parts = node.name.split(' ')
    if (parts.length > 0) return parts[0]
    return null
  }

  private isFunctionLike(node: Node): boolean {
    return (
      Node.isFunctionDeclaration(node) ||
      Node.isArrowFunction(node) ||
      Node.isMethodDeclaration(node) ||
      Node.isFunctionExpression(node)
    )
  }

  private getFunctionKey(fn: FunctionLike): string {
    const file = fn.getSourceFile().getFilePath()
    const line = fn.getStartLineNumber()
    return `${file}:${line}`
  }

  private buildServiceNodeId(fn: FunctionLike): string {
    // 标准化路径：转 POSIX 格式，去掉 Windows 盘符
    let file = fn.getSourceFile().getFilePath().replace(/\\/g, '/')
    // 去掉 Windows 盘符（D: → 空）
    file = file.replace(/^[A-Z]:/i, '')
    const name = Node.isFunctionDeclaration(fn)
      ? fn.getName() ?? 'anonymous'
      : Node.isMethodDeclaration(fn)
        ? fn.getName()
        : 'anonymous'
    return `service:${file}:${name}`
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
