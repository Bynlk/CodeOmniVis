/**
 * 一致性检测器测试
 */

import { describe, it, expect } from 'vitest'
import { ConsistencyChecker } from '../../src/graph/consistency'
import type { OmniGraph, OmniNode, OmniEdge, NodeType } from '@codeomnivis/shared'

const checker = new ConsistencyChecker()

// 仅测试用到的节点类型，按判别联合各自补齐 metadata，避免 metadata:{} 越过封闭类型。
function makeNode(args: { id: string; type?: NodeType; name?: string }): OmniNode {
  const id = args.id
  const name = args.name ?? 'Test'
  const filePath = 'test.tsx'
  const line = 1
  const column = 1
  const type: NodeType = args.type ?? 'page'
  switch (type) {
    case 'component':
      return { id, type, name, filePath, line, column, metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 } }
    case 'api_route':
      return { id, type, name, filePath, line, column, metadata: { method: 'GET', route: '/api', isNextApiRoute: true } }
    case 'module':
      return { id, type, name, filePath, line, column, metadata: { childCount: 0, childTypes: [] } }
    default:
      return { id, type: 'page', name, filePath, line, column, metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null } }
  }
}

// 仅测试用到的 calls_api 边类型，补齐 CallsApiMetadata。
function makeEdge(args: { id: string; source: string; target: string; type: 'calls_api' }): OmniEdge {
  return {
    id: args.id,
    source: args.source,
    target: args.target,
    type: args.type,
    confidence: 'certain',
    metadata: { callType: 'fetch', callLine: 1 },
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
