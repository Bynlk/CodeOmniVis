/**
 * DataFlowTracer.traceFromNode 双向链路追踪测试。
 *
 * 构造一条 component → api_route → service → db_model 的链路,
 * 从中间的 api_route 出发,验证上游(component)与下游(service→db_model)
 * 被双向收集为有序站点,且站点序列、分层、连接边类型正确。
 */

import { describe, it, expect } from 'vitest'
import type { OmniGraph, OmniNode, OmniEdge } from '@codeomnivis/shared'
import { createNodeId, createEdgeId, isTraceResult } from '@codeomnivis/shared'
import { DataFlowTracer } from '../../src/resolver/dataFlowTracer'

const compId = createNodeId('component', 'src/Page.tsx', 'Page')
const apiId = createNodeId('api_route', 'src/api/user.ts', 'getUser')
const svcId = createNodeId('service', 'src/services/user.ts', 'findUser')
const dbId = createNodeId('db_model', 'prisma/schema.prisma', 'User')

const nodes: OmniNode[] = [
  {
    id: compId, type: 'component', name: 'Page', filePath: 'src/Page.tsx', line: 1, column: 0,
    metadata: { props: [], hasState: false, isPage: true, jsxChildCount: 0 },
  },
  {
    id: apiId, type: 'api_route', name: 'getUser', filePath: 'src/api/user.ts', line: 5, column: 0,
    metadata: { method: 'GET', route: '/api/user', isNextApiRoute: true },
  },
  {
    id: svcId, type: 'service', name: 'findUser', filePath: 'src/services/user.ts', line: 9, column: 0,
    metadata: { className: null, methodName: 'findUser' },
  },
  {
    id: dbId, type: 'db_model', name: 'User', filePath: 'prisma/schema.prisma', line: 2, column: 0,
    metadata: { tableName: 'User', fieldCount: 1, fields: [] },
  },
]

const edges: OmniEdge[] = [
  {
    id: createEdgeId(compId, 'calls_api', apiId), source: compId, target: apiId,
    type: 'calls_api', confidence: 'certain', metadata: { callType: 'fetch', callLine: 3 },
  },
  {
    id: createEdgeId(apiId, 'calls_service', svcId), source: apiId, target: svcId,
    type: 'calls_service', confidence: 'certain', metadata: { serviceName: 'findUser' },
  },
  {
    id: createEdgeId(svcId, 'queries_db', dbId), source: svcId, target: dbId,
    type: 'queries_db', confidence: 'certain', metadata: { operation: 'findUnique' },
  },
]

const graph: OmniGraph = { nodes, edges }

describe('DataFlowTracer.traceFromNode', () => {
  it('returns empty result for an unknown node', () => {
    const result = new DataFlowTracer(graph).traceFromNode('does:not/exist:x')
    expect(result.totalSteps).toBe(0)
    expect(result.steps).toEqual([])
  })

  it('produces a TraceResult that passes the shared guard', () => {
    const result = new DataFlowTracer(graph).traceFromNode(apiId)
    expect(isTraceResult(result)).toBe(true)
  })

  it('collects upstream + root + downstream as one ordered chain', () => {
    const result = new DataFlowTracer(graph).traceFromNode(apiId)
    // Page -> getUser -> findUser -> User
    expect(result.steps.map(s => s.nodeId)).toEqual([compId, apiId, svcId, dbId])
    expect(result.steps.map(s => s.index)).toEqual([1, 2, 3, 4])
    expect(result.totalSteps).toBe(4)
  })

  it('assigns correct swimlanes and prev-edge types', () => {
    const result = new DataFlowTracer(graph).traceFromNode(apiId)
    expect(result.steps.map(s => s.layer)).toEqual(['frontend', 'api', 'logic', 'data'])
    // first station has no prev edge; subsequent ones carry the link edge
    expect(result.steps.map(s => s.edgeFromPrev)).toEqual([null, 'calls_api', 'calls_service', 'queries_db'])
  })

  it('every step carries a non-empty static explanation', () => {
    const result = new DataFlowTracer(graph).traceFromNode(apiId)
    for (const step of result.steps) {
      expect(step.explanation.length).toBeGreaterThan(0)
    }
  })

  it('bounds total steps to the shared budget on a long chain (M2 regression)', () => {
    // 构造一条 130 段的 data_flows_to 链:root 在中部,
    // 上游 + 下游共享 64 步预算,total 必须 <= 64(含 root),而非 129。
    const N = 130
    const chainNodes: OmniNode[] = []
    const chainEdges: OmniEdge[] = []
    for (let i = 0; i < N; i++) {
      const id = createNodeId('service', `src/s${i}.ts`, `fn${i}`)
      chainNodes.push({
        id, type: 'service', name: `fn${i}`, filePath: `src/s${i}.ts`, line: 1, column: 0,
        metadata: { className: null, methodName: `fn${i}` },
      })
    }
    for (let i = 0; i < N - 1; i++) {
      const a = chainNodes[i].id
      const b = chainNodes[i + 1].id
      chainEdges.push({
        id: createEdgeId(a, 'data_flows_to', b), source: a, target: b,
        type: 'data_flows_to', confidence: 'certain', metadata: { typeName: 'T', transferMethod: 'return_type' },
      })
    }
    const longGraph: OmniGraph = { nodes: chainNodes, edges: chainEdges }
    // 从中部出发,既有上游又有下游。
    const mid = chainNodes[Math.floor(N / 2)].id
    const result = new DataFlowTracer(longGraph).traceFromNode(mid)
    expect(result.totalSteps).toBeLessThanOrEqual(64)
    expect(result.steps.length).toBe(result.totalSteps)
  })
})
