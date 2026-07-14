import type { OmniNode } from '@codeomnivis/shared'

export interface ProductionIndex {
  byFile: ReadonlyMap<string, readonly OmniNode[]>
  byExportName: ReadonlyMap<string, readonly OmniNode[]>
  byRoute: ReadonlyMap<string, readonly OmniNode[]>
}

function add(map: Map<string, OmniNode[]>, key: string, node: OmniNode): void {
  const values = map.get(key) ?? []
  values.push(node)
  map.set(key, values)
}

export function buildProductionIndex(nodes: readonly OmniNode[]): ProductionIndex {
  const byFile = new Map<string, OmniNode[]>()
  const byExportName = new Map<string, OmniNode[]>()
  const byRoute = new Map<string, OmniNode[]>()
  for (const node of nodes) {
    if (node.type === 'test_suite' || node.type === 'test_case' || node.type === 'test_fixture') continue
    add(byFile, node.filePath.replaceAll('\\', '/'), node)
    add(byExportName, node.name, node)
    if ('methodName' in node.metadata) add(byExportName, node.metadata.methodName, node)
    if ('route' in node.metadata && typeof node.metadata.route === 'string') add(byRoute, node.metadata.route, node)
  }
  return { byFile, byExportName, byRoute }
}
