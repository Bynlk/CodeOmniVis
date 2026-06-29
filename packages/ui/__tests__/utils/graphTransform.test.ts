/**
 * graphToCytoscapeElements 测试
 */

import { describe, it, expect } from 'vitest'
import { graphToCytoscapeElements } from '../../src/utils/graphTransform'
import type { OmniGraph, OmniNode, OmniEdge } from '@codeomnivis/shared'

type CytoscapeElement = ReturnType<typeof graphToCytoscapeElements>[number]

function isNodeElement(element: CytoscapeElement): element is Extract<CytoscapeElement, { group: 'nodes' }> {
  return element.group === 'nodes'
}

function isEdgeElement(element: CytoscapeElement): element is Extract<CytoscapeElement, { group: 'edges' }> {
  return element.group === 'edges'
}

const nodeA: OmniNode = {
  id: 'page:app/page.tsx:/',
  type: 'page',
  name: 'HomePage',
  filePath: 'app/page.tsx',
  line: 1,
  column: 1,
  metadata: { route: '/' },
}

const nodeB: OmniNode = {
  id: 'component:app/Button.tsx:Button',
  type: 'component',
  name: 'Button',
  filePath: 'app/Button.tsx',
  line: 5,
  column: 1,
  metadata: {},
}

const edge1: OmniEdge = {
  id: 'edge-1',
  source: 'page:app/page.tsx:/',
  target: 'component:app/Button.tsx:Button',
  type: 'renders',
  confidence: 'certain',
  metadata: { jsxLine: 10 },
}

describe('graphToCytoscapeElements', () => {
  it('正确转换节点', () => {
    const graph: OmniGraph = { nodes: [nodeA], edges: [] }
    const elements = graphToCytoscapeElements(graph)

    expect(elements).toHaveLength(1)
    expect(elements[0]).toEqual({
      group: 'nodes',
      data: {
        id: 'page:app/page.tsx:/',
        label: 'HomePage',
        type: 'page',
        filePath: 'app/page.tsx',
        line: 1,
        metadata: { route: '/' },
        color: '#6366f1',
      },
    })
  })

  it('正确转换边', () => {
    const graph: OmniGraph = { nodes: [nodeA, nodeB], edges: [edge1] }
    const elements = graphToCytoscapeElements(graph)

    const edgeEl = elements.find(isEdgeElement)
    expect(edgeEl).toBeDefined()
    if (!edgeEl) throw new Error('Expected edge element')

    expect(edgeEl).toEqual({
      group: 'edges',
      data: {
        id: 'edge-1',
        source: 'page:app/page.tsx:/',
        target: 'component:app/Button.tsx:Button',
        type: 'renders',
        confidence: 'certain',
        metadata: { jsxLine: 10 },
      },
    })
  })

  it('过滤掉 source 不存在的边', () => {
    const graph: OmniGraph = {
      nodes: [nodeB],
      edges: [edge1], // source nodeA 不存在
    }
    const elements = graphToCytoscapeElements(graph)

    // 只有节点，没有边
    expect(elements).toHaveLength(1)
    expect(elements[0].group).toBe('nodes')
  })

  it('过滤掉 target 不存在的边', () => {
    const badEdge: OmniEdge = { ...edge1, source: nodeB.id, target: 'nonexistent' }
    const graph: OmniGraph = { nodes: [nodeB], edges: [badEdge] }
    const elements = graphToCytoscapeElements(graph)

    expect(elements).toHaveLength(1)
  })

  it('空图返回空数组', () => {
    expect(graphToCytoscapeElements({ nodes: [], edges: [] })).toEqual([])
  })

  it('节点颜色来自 NODE_COLORS', () => {
    const graph: OmniGraph = { nodes: [nodeA], edges: [] }
    const elements = graphToCytoscapeElements(graph)
    const nodeEl = elements.find(isNodeElement)
    expect(nodeEl).toBeDefined()
    if (!nodeEl) throw new Error('Expected node element')

    expect(nodeEl.data.color).toBe('#6366f1') // page 颜色
  })
})
