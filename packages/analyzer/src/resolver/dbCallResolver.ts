import * as fs from 'fs'
import * as path from 'path'
import type { OmniEdge, OmniNode } from '@codeomnivis/shared'
import { createEdgeId, createTypedEdge, createTypedNode, isNodeOfType } from '@codeomnivis/shared'
import type { CallExpression } from 'ts-morph'
import type { DbCall, TraceResult } from './symbolResolver'
import { SourceScopeResolver } from './sourceScope'

interface SymbolTraceProvider {
  traceHandlerToDb(caller: OmniNode): Promise<TraceResult>
}

export interface DbLinkResult {
  nodes: OmniNode[]
  serviceEdges: OmniEdge[]
  dbEdges: OmniEdge[]
}

export class DbCallResolver {
  private readonly sourceScopes: SourceScopeResolver

  constructor(
    private readonly projectRoot: string,
    sourceScopes?: SourceScopeResolver,
    private readonly symbolResolver: SymbolTraceProvider | null = null,
  ) {
    this.sourceScopes = sourceScopes ?? new SourceScopeResolver(projectRoot)
  }

  async resolve(
    caller: OmniNode,
    dbNodes: OmniNode[],
    eligibleCallersInFile: number,
  ): Promise<DbLinkResult> {
    try {
      const trace = await this.trace(caller)
      const scopedCalls = trace.dbCalls.length > 0
        ? trace.dbCalls
        : this.findScopedCalls(caller, eligibleCallersInFile)
      const dbEdges = this.createDbEdges(caller, dbNodes, scopedCalls)
      const chain = this.createServiceChain(trace.callChain, caller)
      return { nodes: chain.nodes, serviceEdges: chain.edges, dbEdges }
    } catch {
      return { nodes: [], serviceEdges: [], dbEdges: [] }
    }
  }

  private async trace(caller: OmniNode): Promise<TraceResult> {
    if (!this.symbolResolver) return { dbCalls: [], callChain: [], errors: [] }
    try {
      return await this.symbolResolver.traceHandlerToDb(caller)
    } catch {
      return { dbCalls: [], callChain: [], errors: [] }
    }
  }

  private findScopedCalls(caller: OmniNode, eligibleCallersInFile: number): DbCall[] {
    const scope = this.sourceScopes.findScope(caller)
    if (scope) {
      return this.deduplicate(
        this.sourceScopes.getCallExpressions(scope)
          .map(call => this.extractDbCall(call))
          .filter((call): call is DbCall => call !== null),
      )
    }
    if (eligibleCallersInFile !== 1) return []
    return this.scanFile(caller.filePath)
  }

  private extractDbCall(call: CallExpression): DbCall | null {
    const expression = call.getExpression().getText()
    const prisma = expression.match(
      /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)$/,
    )
    if (prisma) return this.dbCall(call, prisma[1], prisma[2], 'certain')

    const repository = expression.match(
      /this\.(\w+?)(?:Repository|Repo)\.(save|find|findOne|findOneBy|findBy|update|delete|remove|count|insert|exist)$/i,
    )
    if (repository) return this.dbCall(call, repository[1], repository[2], 'certain')

    const manager = expression.match(
      /this\.(?:entityManager|manager)\.(save|find|findOne|findOneBy|findBy|remove|delete|update|insert|count)$/,
    )
    const entity = manager ? call.getArguments()[0]?.getText() : null
    if (manager && entity && /^[A-Z]/.test(entity)) {
      return this.dbCall(call, entity, manager[1], 'inferred')
    }
    return null
  }

  private dbCall(
    call: CallExpression,
    modelName: string,
    operation: string,
    confidence: DbCall['confidence'],
  ): DbCall {
    return {
      modelName: capitalize(modelName),
      operation,
      filePath: this.relativePath(call.getSourceFile().getFilePath()),
      line: call.getStartLineNumber(),
      confidence,
    }
  }

  private scanFile(filePath: string): DbCall[] {
    try {
      const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath)
      const content = fs.readFileSync(absolute, 'utf-8')
      const calls: DbCall[] = []
      const pattern = /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\s*\.\s*(\w+)\s*\.\s*(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)/g
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        calls.push({
          modelName: capitalize(match[1]),
          operation: match[2],
          filePath: this.relativePath(absolute),
          line: 0,
          confidence: 'inferred',
        })
      }
      return this.deduplicate(calls)
    } catch {
      return []
    }
  }

  private createDbEdges(caller: OmniNode, dbNodes: OmniNode[], calls: DbCall[]): OmniEdge[] {
    const byName = new Map(
      dbNodes.filter(node => isNodeOfType(node, 'db_model'))
        .map(node => [node.name.toLowerCase(), node]),
    )
    const edges: OmniEdge[] = []
    for (const call of calls) {
      const dbNode = byName.get(call.modelName.toLowerCase())
      if (!dbNode) continue
      const source = this.dbEdgeSource(caller, call)
      edges.push(createTypedEdge({
        id: createEdgeId(source, 'queries_db', dbNode.id),
        source,
        target: dbNode.id,
        type: 'queries_db',
        confidence: call.confidence,
        metadata: { operation: call.operation, callLine: call.line },
      }))
    }
    return edges
  }

  private dbEdgeSource(caller: OmniNode, call: DbCall): string {
    if (!call.ownerId || call.ownerId === caller.id) return caller.id
    return this.normalizeChainId(call.ownerId, caller) ?? caller.id
  }

  private createServiceChain(callChain: string[], caller: OmniNode): { nodes: OmniNode[]; edges: OmniEdge[] } {
    const normalized = callChain.map(id => this.normalizeChainId(id, caller)).filter(Boolean) as string[]
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    for (let index = 1; index < normalized.length; index++) {
      const source = normalized[index - 1]
      const target = normalized[index]
      if (target.startsWith('service:')) {
        const { filePath, name } = this.serviceParts(target)
        nodes.push(createTypedNode({
          id: target,
          type: 'service',
          name,
          filePath,
          line: 0,
          column: 0,
          metadata: { className: null, methodName: name, discoveredBySymbolResolver: true },
        }))
      }
      edges.push(createTypedEdge({
        id: createEdgeId(source, 'calls_service', target),
        source,
        target,
        type: 'calls_service',
        confidence: 'inferred',
        metadata: {},
      }))
    }
    return { nodes: uniqueNodes(nodes), edges: uniqueEdges(edges) }
  }

  private normalizeChainId(id: string, caller: OmniNode): string | null {
    if (id === caller.id) return id
    if (!id.startsWith('service:')) return null
    const { filePath, name } = this.serviceParts(id)
    return `service:${this.relativePath(filePath)}:${name}`
  }

  private serviceParts(id: string): { filePath: string; name: string } {
    const value = id.slice('service:'.length)
    const separator = value.lastIndexOf(':')
    return { filePath: value.slice(0, separator), name: value.slice(separator + 1) }
  }

  private relativePath(filePath: string): string {
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath)
    const relative = path.relative(this.projectRoot, absolute)
    if (relative.startsWith('..') || path.isAbsolute(relative)) return filePath.replaceAll('\\', '/')
    return relative.replaceAll('\\', '/')
  }

  private deduplicate(calls: DbCall[]): DbCall[] {
    return [...new Map(calls.map(call => [`${call.modelName}:${call.operation}`, call])).values()]
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function uniqueNodes(nodes: OmniNode[]): OmniNode[] {
  return [...new Map(nodes.map(node => [node.id, node])).values()]
}

function uniqueEdges(edges: OmniEdge[]): OmniEdge[] {
  return [...new Map(edges.map(edge => [edge.id, edge])).values()]
}
