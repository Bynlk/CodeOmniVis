import * as fs from 'node:fs'
import * as path from 'node:path'
import { createEdgeId, type OmniEdge, type OmniNode, type ParseResult } from '@codeomnivis/shared'
import { buildProductionIndex } from './productionIndex'

function sourceFor(filePath: string, projectRoot: string, sources?: ReadonlyMap<string, string>): string {
  const supplied = sources?.get(filePath)
  if (supplied !== undefined) return supplied
  try {
    return fs.readFileSync(path.resolve(projectRoot, filePath), 'utf8')
  } catch {
    return ''
  }
}

function importedFile(testFile: string, specifier: string): string[] {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(testFile), specifier))
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}/index.ts`, `${base}/index.tsx`]
}

export function linkTestsToProduction(
  discovery: ParseResult,
  productionNodes: readonly OmniNode[],
  projectRoot: string,
  sources?: ReadonlyMap<string, string>,
): ParseResult {
  const index = buildProductionIndex(productionNodes)
  const linked = new Map<string, OmniEdge>(discovery.edges.map(edge => [edge.id, edge]))
  for (const testCase of discovery.nodes.filter(node => node.type === 'test_case')) {
    const source = sourceFor(testCase.filePath, projectRoot, sources)
    const imports = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/gu
    for (const match of source.matchAll(imports)) {
      const files = importedFile(testCase.filePath, match[2])
      const fileNodes = files.flatMap(file => [...(index.byFile.get(file) ?? [])])
      for (const binding of match[1].split(',')) {
        const [original, local = original] = binding.trim().split(/\s+as\s+/u)
        const candidates = fileNodes.filter(node => node.name === original || ('methodName' in node.metadata && node.metadata.methodName === original))
        if (candidates.length !== 1) continue
        const target = candidates[0]
        const called = new RegExp(`\\b${local.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*\\(`, 'u').test(source)
        const edge: OmniEdge = {
          id: createEdgeId(testCase.id, 'covers', target.id), source: testCase.id, target: target.id,
          type: 'covers', confidence: called ? 'certain' : 'inferred',
          metadata: { evidence: called ? 'direct_call' : 'direct_import' },
        }
        const current = linked.get(edge.id)
        if (!current || (current.confidence === 'inferred' && edge.confidence === 'certain')) linked.set(edge.id, edge)
      }
    }
    for (const [route, targets] of index.byRoute) {
      if (!source.includes(`'${route}'`) && !source.includes(`"${route}"`)) continue
      for (const target of targets) {
        const edge: OmniEdge = { id: createEdgeId(testCase.id, 'covers', target.id), source: testCase.id, target: target.id, type: 'covers', confidence: 'inferred', metadata: { evidence: 'route_reference' } }
        if (!linked.has(edge.id)) linked.set(edge.id, edge)
      }
    }
  }
  return { nodes: discovery.nodes, edges: [...linked.values()], errors: discovery.errors }
}
