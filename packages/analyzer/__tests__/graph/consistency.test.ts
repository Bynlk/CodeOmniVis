/**
 * 一致性检测器测试
 */

import { describe, it, expect } from 'vitest'
import { ConsistencyChecker } from '../../src/graph/consistency'
import type { OmniGraph, OmniNode, OmniEdge } from '@omnivis/shared'

const checker = new ConsistencyChecker()

function makeNode(overrides: Partial<OmniNode> & { id: string }): OmniNode {
  return {
    type: 'page',
    name: 'Test',
    filePath: 'test.tsx',
    line: 1,
    column: 1,
    metadata: {},
    ...overrides,
  }
}

function makeEdge(overrides: Partial<OmniEdge> & { id: string; source: string; target: string; type: OmniEdge['type'] }): OmniEdge {
  return {
    confidence: 'certain',
    metadata: {},
    ...overrides,
  }
}

describe('ConsistencyChecker', () => {
  it('空图返回空报告', () => {
    const report = checker.check({ nodes: [], edges: [] })
    expect(report.issues).toHaveLength(0)
    expect(report.summary.total).toBe(0)
  })

  it('正常图无问题', () => {
    const graph: OmniGraph = {
      nodes: [
        makeNode({ id: 'page:app/page.tsx:/', type: 'page' }),
        makeNode({ id: 'api_route:app/api/route.ts:/api', type: 'api_route' }),
      ],
      edges: [
        makeEdge({ id: 'e1', source: 'page:app/page.tsx:/', target: 'api_route:app/api/route.ts:/api', type: 'calls_api' }),
      ],
    }
    const report = checker.check(graph)
    expect(report.issues).toHaveLength(0)
  })

  // ─── 死链 API 调用 ───
  it('检测死链 API 调用', () => {
    const graph: OmniGraph = {
      nodes: [makeNode({ id: 'page:app/page.tsx:/', type: 'page' })],
      edges: [
        makeEdge({ id: 'e1', source: 'page:app/page.tsx:/', target: 'api_route:nonexistent:/api', type: 'calls_api' }),
      ],
    }
    const report = checker.check(graph)
    const deadCalls = report.issues.filter(i => i.type === 'dead_api_call')
    expect(deadCalls).toHaveLength(1)
    expect(deadCalls[0].severity).toBe('warning')
  })

  // ─── 未使用路由 ───
  it('检测未使用路由', () => {
    const graph: OmniGraph = {
      nodes: [
        makeNode({ id: 'api_route:app/api/route.ts:/api', type: 'api_route' }),
      ],
      edges: [],
    }
    const report = checker.check(graph)
    // unused_route 和 orphan 都使用 type='unused_route'，按 description 区分
    const unused = report.issues.filter(i => i.type === 'unused_route' && i.description.includes('unused'))
    expect(unused).toHaveLength(1)
  })

  it('有入边的路由不算未使用', () => {
    const graph: OmniGraph = {
      nodes: [
        makeNode({ id: 'page:app/page.tsx:/', type: 'page' }),
        makeNode({ id: 'api_route:app/api/route.ts:/api', type: 'api_route' }),
      ],
      edges: [
        makeEdge({ id: 'e1', source: 'page:app/page.tsx:/', target: 'api_route:app/api/route.ts:/api', type: 'calls_api' }),
      ],
    }
    const report = checker.check(graph)
    const unused = report.issues.filter(i => i.type === 'unused_route' && i.relatedNodeIds[0] === 'api_route:app/api/route.ts:/api')
    expect(unused).toHaveLength(0)
  })

  // ─── 孤立节点 ───
  it('检测孤立节点', () => {
    const graph: OmniGraph = {
      nodes: [
        makeNode({ id: 'component:app/Button.tsx:Button', type: 'component' }),
      ],
      edges: [],
    }
    const report = checker.check(graph)
    const orphans = report.issues.filter(i => i.description.includes('no connections'))
    expect(orphans).toHaveLength(1)
  })

  it('module 类型不算孤立', () => {
    const graph: OmniGraph = {
      nodes: [
        makeNode({ id: 'module:app/m:mod', type: 'module' }),
      ],
      edges: [],
    }
    const report = checker.check(graph)
    const orphans = report.issues.filter(i => i.description.includes('no connections'))
    expect(orphans).toHaveLength(0)
  })

  // ─── 统计 ───
  it('summary 统计正确', () => {
    const graph: OmniGraph = {
      nodes: [
        makeNode({ id: 'page:app/page.tsx:/', type: 'page' }),
        makeNode({ id: 'api_route:app/api/route.ts:/api', type: 'api_route' }),
        makeNode({ id: 'component:app/Button.tsx:Button', type: 'component' }),
      ],
      edges: [
        makeEdge({ id: 'e1', source: 'page:app/page.tsx:/', target: 'api_route:nonexistent:/api', type: 'calls_api' }),
      ],
    }
    const report = checker.check(graph)
    expect(report.summary.total).toBeGreaterThan(0)
    expect(report.summary.total).toBe(report.summary.critical + report.summary.warning + report.summary.info)
  })
})
