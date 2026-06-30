/**
 * 图噪声治理 sanitizeGraph 测试。
 */

import { describe, it, expect } from 'vitest'
import { sanitizeGraph } from '../../src/types/graph'
import type { OmniGraph, OmniNode, OmniEdge } from '../../src/types/graph'

const nodeA: OmniNode = {
  id: 'page:app/page.tsx:/', type: 'page', name: 'Home', filePath: 'app/page.tsx', line: 1, column: 0,
  metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
}
const nodeB: OmniNode = {
  id: 'component:app/B.tsx:B', type: 'component', name: 'B', filePath: 'app/B.tsx', line: 1, column: 0,
  metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
}

function edge(id: string, source: string, target: string): OmniEdge {
  return { id, source, target, type: 'renders', confidence: 'certain', metadata: {} }
}

describe('sanitizeGraph', () => {
  it('keeps a clean graph unchanged and reports zero noise', () => {
    const graph: OmniGraph = { nodes: [nodeA, nodeB], edges: [edge('e1', nodeA.id, nodeB.id)] }
    const { graph: out, stats } = sanitizeGraph(graph)
    expect(out.edges).toHaveLength(1)
    expect(stats).toEqual({ selfReferences: 0, danglingEndpoints: 0, duplicateEdges: 0 })
  })

  it('removes self-reference edges', () => {
    const graph: OmniGraph = { nodes: [nodeA], edges: [edge('e1', nodeA.id, nodeA.id)] }
    const { graph: out, stats } = sanitizeGraph(graph)
    expect(out.edges).toHaveLength(0)
    expect(stats.selfReferences).toBe(1)
  })

  it('removes edges whose endpoints are missing from the node set', () => {
    const graph: OmniGraph = { nodes: [nodeA], edges: [edge('e1', nodeA.id, 'ghost:x:y')] }
    const { graph: out, stats } = sanitizeGraph(graph)
    expect(out.edges).toHaveLength(0)
    expect(stats.danglingEndpoints).toBe(1)
  })

  it('collapses duplicate (source,type,target) edges, keeping the first', () => {
    const graph: OmniGraph = {
      nodes: [nodeA, nodeB],
      edges: [edge('e1', nodeA.id, nodeB.id), edge('e2', nodeA.id, nodeB.id)],
    }
    const { graph: out, stats } = sanitizeGraph(graph)
    expect(out.edges).toHaveLength(1)
    expect(out.edges[0].id).toBe('e1')
    expect(stats.duplicateEdges).toBe(1)
  })

  it('preserves same endpoints when edge type differs', () => {
    const graph: OmniGraph = {
      nodes: [nodeA, nodeB],
      edges: [
        edge('e1', nodeA.id, nodeB.id),
        { id: 'e2', source: nodeA.id, target: nodeB.id, type: 'imports', confidence: 'certain', metadata: {} },
      ],
    }
    const { graph: out, stats } = sanitizeGraph(graph)
    expect(out.edges).toHaveLength(2)
    expect(stats.duplicateEdges).toBe(0)
  })

  it('does not mutate the input graph', () => {
    const edges = [edge('e1', nodeA.id, nodeA.id)]
    const graph: OmniGraph = { nodes: [nodeA], edges }
    sanitizeGraph(graph)
    expect(edges).toHaveLength(1)
  })
})
