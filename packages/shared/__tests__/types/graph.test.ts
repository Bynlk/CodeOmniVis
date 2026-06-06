/**
 * 图工具函数测试
 */

import { describe, it, expect } from 'vitest'
import {
  mergeParseResults,
  getNode,
  getInEdges,
  getOutEdges,
  filterNodesByType,
  filterEdgesByType,
} from '../../src/types/graph'
import type { OmniGraph, OmniNode, OmniEdge, ParseResult } from '../../src/types/graph'

// 测试数据
const nodeA: OmniNode = {
  id: 'page:app/page.tsx:/',
  type: 'page',
  name: 'HomePage',
  filePath: 'app/page.tsx',
  line: 1,
  column: 1,
  metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
}

const nodeB: OmniNode = {
  id: 'component:app/Button.tsx:Button',
  type: 'component',
  name: 'Button',
  filePath: 'app/Button.tsx',
  line: 5,
  column: 1,
  metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
}

const nodeC: OmniNode = {
  id: 'db_model:prisma/schema.prisma:User',
  type: 'db_model',
  name: 'User',
  filePath: 'prisma/schema.prisma',
  line: 10,
  column: 1,
  metadata: { tableName: 'User', fieldCount: 3, fields: [] },
}

const edge1: OmniEdge = {
  id: 'edge-1',
  source: 'page:app/page.tsx:/',
  target: 'component:app/Button.tsx:Button',
  type: 'renders',
  confidence: 'certain',
  metadata: { jsxLine: 10 },
}

const edge2: OmniEdge = {
  id: 'edge-2',
  source: 'component:app/Button.tsx:Button',
  target: 'db_model:prisma/schema.prisma:User',
  type: 'queries_db',
  confidence: 'inferred',
  metadata: { operation: 'findMany', callLine: 20 },
}

const graph: OmniGraph = {
  nodes: [nodeA, nodeB, nodeC],
  edges: [edge1, edge2],
}

describe('mergeParseResults', () => {
  it('合并多个 ParseResult', () => {
    const r1: ParseResult = { nodes: [nodeA], edges: [edge1], errors: [] }
    const r2: ParseResult = { nodes: [nodeB], edges: [edge2], errors: [{ file: 'test.ts', message: 'err', severity: 'warning' }] }

    const merged = mergeParseResults(r1, r2)
    expect(merged.nodes).toHaveLength(2)
    expect(merged.edges).toHaveLength(2)
    expect(merged.errors).toHaveLength(1)
  })

  it('空结果不影响合并', () => {
    const r: ParseResult = { nodes: [nodeA], edges: [], errors: [] }
    const empty: ParseResult = { nodes: [], edges: [], errors: [] }

    const merged = mergeParseResults(empty, r, empty)
    expect(merged.nodes).toHaveLength(1)
  })
})

describe('getNode', () => {
  it('查找存在的节点', () => {
    expect(getNode(graph, 'page:app/page.tsx:/')).toBe(nodeA)
    expect(getNode(graph, 'db_model:prisma/schema.prisma:User')).toBe(nodeC)
  })

  it('不存在的节点返回 undefined', () => {
    expect(getNode(graph, 'nonexistent')).toBeUndefined()
  })
})

describe('getInEdges', () => {
  it('返回指向指定节点的边', () => {
    const inEdges = getInEdges(graph, 'component:app/Button.tsx:Button')
    expect(inEdges).toHaveLength(1)
    expect(inEdges[0].id).toBe('edge-1')
  })

  it('没有入边时返回空数组', () => {
    expect(getInEdges(graph, 'page:app/page.tsx:/')).toHaveLength(0)
  })
})

describe('getOutEdges', () => {
  it('返回从指定节点出发的边', () => {
    const outEdges = getOutEdges(graph, 'component:app/Button.tsx:Button')
    expect(outEdges).toHaveLength(1)
    expect(outEdges[0].id).toBe('edge-2')
  })

  it('没有出边时返回空数组', () => {
    expect(getOutEdges(graph, 'db_model:prisma/schema.prisma:User')).toHaveLength(0)
  })
})

describe('filterNodesByType', () => {
  it('按类型过滤节点', () => {
    expect(filterNodesByType(graph, 'page')).toHaveLength(1)
    expect(filterNodesByType(graph, 'component')).toHaveLength(1)
    expect(filterNodesByType(graph, 'db_model')).toHaveLength(1)
    expect(filterNodesByType(graph, 'service')).toHaveLength(0)
  })
})

describe('filterEdgesByType', () => {
  it('按类型过滤边', () => {
    expect(filterEdgesByType(graph, 'renders')).toHaveLength(1)
    expect(filterEdgesByType(graph, 'queries_db')).toHaveLength(1)
    expect(filterEdgesByType(graph, 'calls_api')).toHaveLength(0)
  })
})
