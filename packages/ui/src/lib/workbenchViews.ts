import type { EdgeType, NodeType, OmniEdge, OmniGraph, OmniNode } from '@codeomnivis/shared'
import type { WorkbenchGraphOptions } from '../types/workbench'
import { selectTestGraph } from './testView'

const REQUEST_EDGES = new Set<EdgeType>([
  'renders', 'navigates_to', 'calls_api', 'handles', 'calls_service', 'queries_db',
  'data_flows_to', 'sends_msg', 'listens_msg',
])

const DATA_EDGES = new Set<EdgeType>(['queries_db', 'db_relation', 'data_flows_to'])
const WORKBENCH_MODULE_PREFIX = 'module:workbench/'

function graphFromEdges(graph: OmniGraph, edgeTypes: Set<EdgeType>): OmniGraph {
  const edges = graph.edges.filter(edge => edgeTypes.has(edge.type))
  const nodeIds = new Set(edges.flatMap(edge => [edge.source, edge.target]))
  return { nodes: graph.nodes.filter(node => nodeIds.has(node.id)), edges }
}

function focusGraph(graph: OmniGraph, focusNodeId: string | null | undefined): OmniGraph {
  if (focusNodeId?.startsWith(WORKBENCH_MODULE_PREFIX)) {
    const scopeWithName = focusNodeId.slice(WORKBENCH_MODULE_PREFIX.length)
    const scope = scopeWithName.slice(0, scopeWithName.lastIndexOf(':'))
    const nodes = graph.nodes.filter(node => {
      const nodeScope = scopeForFile(node.filePath)
      return scope.includes('/') ? nodeScope.leaf === scope : nodeScope.root === scope
    })
    const nodeIds = new Set(nodes.map(node => node.id))
    return {
      nodes,
      edges: graph.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    }
  }
  if (!focusNodeId || !graph.nodes.some(node => node.id === focusNodeId)) return graph
  const edges = graph.edges.filter(edge => edge.source === focusNodeId || edge.target === focusNodeId)
  const nodeIds = new Set([focusNodeId, ...edges.flatMap(edge => [edge.source, edge.target])])
  return { nodes: graph.nodes.filter(node => nodeIds.has(node.id)), edges }
}

function scopeForFile(filePath: string): { root: string; leaf: string } {
  const parts = filePath.replaceAll('\\', '/').split('/').filter(Boolean)
  if (parts.length <= 1) return { root: 'project', leaf: 'project' }

  const root = parts[0]
  if ((root === 'frontend' || root === 'backend') && parts[1] === 'src' && parts.length > 3) {
    return { root, leaf: `${root}/${parts[2]}` }
  }
  if (parts.length > 2) return { root, leaf: `${root}/${parts[1]}` }
  return { root, leaf: root }
}

function createModuleNode(scope: string, children: OmniNode[]): OmniNode {
  const childTypes = [...new Set(children.map(node => node.type))] as NodeType[]
  return {
    id: `${WORKBENCH_MODULE_PREFIX}${scope}:${scope.split('/').at(-1) ?? scope}`,
    type: 'module',
    name: scope.replaceAll('/', ' / '),
    filePath: scope,
    line: 1,
    column: 1,
    metadata: { childCount: children.length, childTypes, dirPath: scope },
  }
}

function architectureOverview(graph: OmniGraph): OmniGraph {
  const scopeNodes = new Map<string, OmniNode[]>()
  const nodeScope = new Map<string, string>()

  for (const node of graph.nodes) {
    const { root, leaf } = scopeForFile(node.filePath)
    nodeScope.set(node.id, leaf)
    scopeNodes.set(leaf, [...(scopeNodes.get(leaf) ?? []), node])
    if (!scopeNodes.has(root)) scopeNodes.set(root, [])
  }

  const scopes = [...scopeNodes.keys()].sort((a, b) => a.localeCompare(b))
  const nodes = scopes.map(scope => {
    const descendants = graph.nodes.filter(node => {
      const normalized = node.filePath.replaceAll('\\', '/')
      return normalized === scope || normalized.startsWith(`${scope}/`)
    })
    return createModuleNode(scope, descendants)
  })

  const edges: OmniEdge[] = []
  for (const scope of scopes) {
    if (!scope.includes('/')) continue
    const root = scope.split('/')[0]
    const source = `${WORKBENCH_MODULE_PREFIX}${root}:${root}`
    const target = `${WORKBENCH_MODULE_PREFIX}${scope}:${scope.split('/').at(-1) ?? scope}`
    edges.push({
      id: `${source}--contains--${target}`,
      source,
      target,
      type: 'contains',
      confidence: 'certain',
      metadata: { reason: 'directory' },
    })
  }

  const aggregateKeys = new Set<string>()
  for (const edge of graph.edges) {
    const sourceScope = nodeScope.get(edge.source)
    const targetScope = nodeScope.get(edge.target)
    if (!sourceScope || !targetScope || sourceScope === targetScope) continue
    const source = `${WORKBENCH_MODULE_PREFIX}${sourceScope}:${sourceScope.split('/').at(-1) ?? sourceScope}`
    const target = `${WORKBENCH_MODULE_PREFIX}${targetScope}:${targetScope.split('/').at(-1) ?? targetScope}`
    const key = `${source}--${edge.type}--${target}`
    if (aggregateKeys.has(key)) continue
    aggregateKeys.add(key)
    edges.push({ ...edge, id: key, source, target })
  }

  return { nodes, edges }
}

export function deriveWorkbenchGraph(graph: OmniGraph, options: WorkbenchGraphOptions): OmniGraph {
  if (options.view === 'architecture' && options.searchQuery?.trim()) return graph
  if (options.depth === 'focus') return focusGraph(graph, options.focusNodeId)

  if (options.view === 'requests') return graphFromEdges(graph, REQUEST_EDGES)
  if (options.view === 'data') return graphFromEdges(graph, DATA_EDGES)
  if (options.view === 'tests') return selectTestGraph(graph, options.focusNodeId)

  if (options.view === 'architecture' && options.depth === 'overview') {
    return architectureOverview(graph)
  }

  return graph
}
