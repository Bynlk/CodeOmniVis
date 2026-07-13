import { describe, expect, it } from 'vitest'
import type { OmniGraph, OmniNode, OmniEdge } from '@codeomnivis/shared'
import { deriveWorkbenchGraph } from '../../src/lib/workbenchViews'

const nodes: OmniNode[] = [
  { id: 'page', type: 'page', name: '/', filePath: 'app/page.tsx', line: 1, column: 1, metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null } },
  { id: 'component', type: 'component', name: 'Screen', filePath: 'components/Screen.tsx', line: 1, column: 1, metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 } },
  { id: 'api', type: 'api_route', name: '/api/items', filePath: 'app/api/items/route.ts', line: 1, column: 1, metadata: { method: 'GET', route: '/api/items', isNextApiRoute: true } },
  { id: 'handler', type: 'handler', name: 'GET', filePath: 'app/api/items/route.ts', line: 1, column: 1, metadata: { functionName: 'GET', routeId: 'api' } },
  { id: 'db', type: 'db_model', name: 'Item', filePath: 'schema.prisma', line: 1, column: 1, metadata: { tableName: 'items', fieldCount: 0, fields: [] } },
]

const edges: OmniEdge[] = [
  { id: 'renders', source: 'page', target: 'component', type: 'renders', confidence: 'certain', metadata: {} },
  { id: 'calls', source: 'component', target: 'api', type: 'calls_api', confidence: 'certain', metadata: { callType: 'fetch', callLine: 2 } },
  { id: 'handles', source: 'api', target: 'handler', type: 'handles', confidence: 'certain', metadata: { handlerName: 'GET' } },
  { id: 'queries', source: 'handler', target: 'db', type: 'queries_db', confidence: 'certain', metadata: {} },
  { id: 'relation', source: 'db', target: 'db', type: 'db_relation', confidence: 'certain', metadata: { relationName: 'self', relationType: 'one_to_many' } },
]

const graph: OmniGraph = { nodes, edges }

describe('deriveWorkbenchGraph', () => {
  it('shows only architectural landmarks in overview depth', () => {
    const result = deriveWorkbenchGraph(graph, { view: 'architecture', depth: 'overview' })
    expect(result.nodes.map(node => node.name)).toEqual(['app', 'app / api', 'components', 'project'])
    expect(result.edges.map(edge => edge.type)).toEqual(['contains', 'renders', 'calls_api', 'queries_db'])
  })

  it('expands a workbench module into the real nodes in that scope', () => {
    const result = deriveWorkbenchGraph(graph, {
      view: 'architecture',
      depth: 'focus',
      focusNodeId: 'module:workbench/app:app',
    })
    expect(result.nodes.map(node => node.id)).toEqual(['page', 'api', 'handler'])
    expect(result.edges.map(edge => edge.id)).toEqual(['handles'])
  })

  it('expands a simplified frontend/src scope back to its source files', () => {
    const scopedNode: OmniNode = {
      id: 'ipad-app',
      type: 'component',
      name: 'App',
      filePath: 'frontend/src/ipad/App.tsx',
      line: 1,
      column: 1,
      metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
    }
    const result = deriveWorkbenchGraph({ nodes: [scopedNode], edges: [] }, {
      view: 'architecture',
      depth: 'focus',
      focusNodeId: 'module:workbench/frontend/ipad:ipad',
    })
    expect(result.nodes.map(node => node.id)).toEqual(['ipad-app'])
  })

  it('keeps request lifecycle edges and excludes schema-only relations', () => {
    const result = deriveWorkbenchGraph(graph, { view: 'requests', depth: 'full' })
    expect(result.edges.map(edge => edge.type)).toEqual(['renders', 'calls_api', 'handles', 'queries_db'])
  })

  it('keeps data access and model relations in data view', () => {
    const result = deriveWorkbenchGraph(graph, { view: 'data', depth: 'full' })
    expect(result.edges.map(edge => edge.type)).toEqual(['queries_db', 'db_relation'])
    expect(result.nodes.map(node => node.id)).toEqual(['handler', 'db'])
  })

  it('limits focus depth to the selected node and its direct neighborhood', () => {
    const result = deriveWorkbenchGraph(graph, { view: 'architecture', depth: 'focus', focusNodeId: 'api' })
    expect(result.nodes.map(node => node.id)).toEqual(['component', 'api', 'handler'])
    expect(result.edges.map(edge => edge.id)).toEqual(['calls', 'handles'])
  })

  it('searches real architecture nodes instead of aggregated overview modules', () => {
    const result = deriveWorkbenchGraph(graph, {
      view: 'architecture',
      depth: 'overview',
      searchQuery: 'Screen',
    })

    expect(result.nodes.map(node => node.id)).toContain('component')
    expect(result.nodes.some(node => node.type === 'module')).toBe(false)
  })
})
