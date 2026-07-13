import * as fs from 'fs'
import * as path from 'path'
import { Node, Project, SourceFile, SyntaxKind, type CallExpression } from 'ts-morph'
import type { OmniNode } from '@codeomnivis/shared'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

export class SourceScopeResolver {
  private readonly project = new Project({ skipAddingFilesFromTsConfig: true })

  constructor(private readonly projectRoot: string) {}

  resolveImport(fromFile: string, importPath: string): string | null {
    if (!importPath.startsWith('.')) return null
    const fromAbsolute = this.resolveFilePath(fromFile)
    const base = path.resolve(path.dirname(fromAbsolute), importPath)
    const candidates = [
      base,
      ...SOURCE_EXTENSIONS.map(extension => `${base}${extension}`),
      ...SOURCE_EXTENSIONS.map(extension => path.join(base, `index${extension}`)),
    ]

    for (const candidate of candidates) {
      try {
        if (!fs.statSync(candidate).isFile()) continue
        const realRoot = fs.realpathSync.native(this.projectRoot)
        const realCandidate = fs.realpathSync.native(candidate)
        const relative = path.relative(realRoot, realCandidate)
        if (relative.startsWith('..') || path.isAbsolute(relative)) return null
        return normalizePath(relative)
      } catch {
        // Try the next supported source-file candidate.
      }
    }
    return null
  }

  findScope(caller: OmniNode): Node | null {
    const sourceFile = this.getSourceFile(caller.filePath)
    if (!sourceFile) return null
    const name = this.callerName(caller)
    if (!name) return null

    const candidates: Node[] = []
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      if (declaration.getName() === name) candidates.push(declaration)
    }
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
      if (declaration.getName() === name) candidates.push(declaration)
    }
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      if (declaration.getName() === name) candidates.push(declaration)
    }
    for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (declaration.getName() === name) candidates.push(declaration)
    }

    if (candidates.length === 0) return null
    if (caller.line <= 0) return candidates[0]
    return candidates.sort((left, right) =>
      Math.abs(left.getStartLineNumber() - caller.line) - Math.abs(right.getStartLineNumber() - caller.line)
    )[0]
  }

  getCallExpressions(scope: Node): CallExpression[] {
    return scope.getDescendantsOfKind(SyntaxKind.CallExpression)
  }

  getSourceFile(filePath: string): SourceFile | null {
    const absolute = this.resolveFilePath(filePath)
    try {
      return this.project.getSourceFile(absolute) ?? this.project.addSourceFileAtPath(absolute)
    } catch {
      return null
    }
  }

  private resolveFilePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath)
  }

  private callerName(caller: OmniNode): string | null {
    if (caller.type === 'handler') return caller.metadata.functionName
    if (caller.type === 'service') return caller.metadata.methodName
    if (caller.type === 'trpc_procedure') return caller.metadata.procedureName
    return null
  }
}
