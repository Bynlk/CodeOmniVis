import type { OmniEdge, OmniNode } from '@codeomnivis/shared'
import { createEdgeId, createTypedEdge, createTypedNode, isNodeOfType } from '@codeomnivis/shared'
import { Node, type SourceFile } from 'ts-morph'
import { SourceScopeResolver } from './sourceScope'

interface ServiceBinding {
  localName: string
  serviceName: string
  resolvedPath: string
  isDefault: boolean
}

export interface ServiceLinkResult {
  nodes: OmniNode[]
  edges: OmniEdge[]
}

export class ServiceLinkResolver {
  private readonly sourceScopes: SourceScopeResolver

  constructor(projectRoot: string, sourceScopes?: SourceScopeResolver) {
    this.sourceScopes = sourceScopes ?? new SourceScopeResolver(projectRoot)
  }

  resolve(caller: OmniNode, serviceNodes: OmniNode[]): ServiceLinkResult {
    try {
      const scope = this.sourceScopes.findScope(caller)
      if (!scope) return { nodes: [], edges: [] }

      const bindings = this.collectBindings(caller.filePath, scope.getSourceFile(), serviceNodes)
      const nodes: OmniNode[] = []
      const edges: OmniEdge[] = []
      const seenTargets = new Set<string>()

      for (const call of this.sourceScopes.getCallExpressions(scope)) {
        const binding = this.matchCall(call.getExpression(), bindings)
        if (!binding) continue

        const serviceName = this.calledServiceName(call.getExpression(), binding)
        const existing = serviceNodes.find(node =>
          isNodeOfType(node, 'service')
          && node.filePath === binding.resolvedPath
          && (node.name === serviceName || node.metadata.methodName === serviceName)
        )
        const target = existing ?? createTypedNode({
          id: `service:${binding.resolvedPath}:${serviceName}`,
          type: 'service',
          name: serviceName,
          filePath: binding.resolvedPath,
          line: 0,
          column: 0,
          metadata: {
            className: null,
            methodName: serviceName,
            isSynthetic: true,
            importedFrom: caller.filePath,
          },
        })

        if (seenTargets.has(target.id)) continue
        seenTargets.add(target.id)
        if (!existing) nodes.push(target)
        edges.push(createTypedEdge({
          id: createEdgeId(caller.id, 'calls_service', target.id),
          source: caller.id,
          target: target.id,
          type: 'calls_service',
          confidence: 'certain',
          metadata: { serviceName, callLine: call.getStartLineNumber() },
        }))
      }

      return { nodes, edges }
    } catch {
      return { nodes: [], edges: [] }
    }
  }

  private collectBindings(
    callerFile: string,
    sourceFile: SourceFile,
    serviceNodes: OmniNode[],
  ): ServiceBinding[] {
    const bindings: ServiceBinding[] = []
    for (const declaration of sourceFile.getImportDeclarations()) {
      if (declaration.isTypeOnly()) continue
      const resolvedPath = this.sourceScopes.resolveImport(
        callerFile,
        declaration.getModuleSpecifierValue(),
      )
      if (!resolvedPath) continue
      const hasKnownService = serviceNodes.some(node =>
        isNodeOfType(node, 'service') && node.filePath === resolvedPath
      )
      if (!hasKnownService && !this.looksLikeServicePath(resolvedPath)) continue

      const defaultImport = declaration.getDefaultImport()
      if (defaultImport) {
        const localName = defaultImport.getText()
        bindings.push({ localName, serviceName: localName, resolvedPath, isDefault: true })
      }
      for (const namedImport of declaration.getNamedImports()) {
        if (namedImport.isTypeOnly()) continue
        bindings.push({
          localName: namedImport.getAliasNode()?.getText() ?? namedImport.getName(),
          serviceName: namedImport.getName(),
          resolvedPath,
          isDefault: false,
        })
      }
    }
    return bindings
  }

  private matchCall(expression: Node, bindings: ServiceBinding[]): ServiceBinding | null {
    if (Node.isIdentifier(expression)) {
      return bindings.find(binding => binding.localName === expression.getText()) ?? null
    }
    if (Node.isPropertyAccessExpression(expression)) {
      const owner = expression.getExpression()
      if (!Node.isIdentifier(owner)) return null
      return bindings.find(binding => binding.isDefault && binding.localName === owner.getText()) ?? null
    }
    return null
  }

  private calledServiceName(expression: Node, binding: ServiceBinding): string {
    return Node.isPropertyAccessExpression(expression) ? expression.getName() : binding.serviceName
  }

  private looksLikeServicePath(filePath: string): boolean {
    if (/(?:handler|test|mock|config|constant|util|helper)/i.test(filePath)) return false
    return /(?:service|repository|repo|di\/)/i.test(filePath)
  }
}
