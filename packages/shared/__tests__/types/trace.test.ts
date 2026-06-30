/**
 * 全链路追踪契约 guard 测试。
 */

import { describe, it, expect } from 'vitest'
import {
  isTraceLayer,
  isTraceStep,
  isTraceResult,
  traceLayerForNodeType,
  TRACE_LAYER_ORDER,
  type TraceStep,
  type TraceResult,
} from '../../src/types/trace'

const validStep: TraceStep = {
  index: 1,
  nodeId: 'component:src/A.tsx:A',
  nodeName: 'A',
  nodeType: 'component',
  layer: 'frontend',
  filePath: 'src/A.tsx',
  line: 10,
  edgeFromPrev: null,
  explanation: '链路起点',
}

describe('traceLayerForNodeType', () => {
  it('maps node types to swimlanes exhaustively', () => {
    expect(traceLayerForNodeType('page')).toBe('frontend')
    expect(traceLayerForNodeType('component')).toBe('frontend')
    expect(traceLayerForNodeType('api_route')).toBe('api')
    expect(traceLayerForNodeType('express_route')).toBe('api')
    expect(traceLayerForNodeType('handler')).toBe('logic')
    expect(traceLayerForNodeType('service')).toBe('logic')
    expect(traceLayerForNodeType('db_model')).toBe('data')
    expect(traceLayerForNodeType('module')).toBe('other')
    expect(traceLayerForNodeType('kotlin_class')).toBe('other')
  })

  it('every layer it returns is a member of TRACE_LAYER_ORDER', () => {
    for (const layer of TRACE_LAYER_ORDER) {
      expect(isTraceLayer(layer)).toBe(true)
    }
  })
})

describe('isTraceLayer', () => {
  it('accepts the five valid layers', () => {
    expect(isTraceLayer('frontend')).toBe(true)
    expect(isTraceLayer('api')).toBe(true)
    expect(isTraceLayer('logic')).toBe(true)
    expect(isTraceLayer('data')).toBe(true)
    expect(isTraceLayer('other')).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(isTraceLayer('backend')).toBe(false)
    expect(isTraceLayer(3)).toBe(false)
    expect(isTraceLayer(null)).toBe(false)
  })
})

describe('isTraceStep', () => {
  it('accepts a well-formed step (null edge)', () => {
    expect(isTraceStep(validStep)).toBe(true)
  })

  it('accepts a step with a valid edge type', () => {
    expect(isTraceStep({ ...validStep, edgeFromPrev: 'calls_api' })).toBe(true)
  })

  it('rejects invalid nodeType', () => {
    expect(isTraceStep({ ...validStep, nodeType: 'widget' })).toBe(false)
  })

  it('rejects invalid edge type', () => {
    expect(isTraceStep({ ...validStep, edgeFromPrev: 'teleports' })).toBe(false)
  })

  it('rejects invalid layer / missing fields', () => {
    expect(isTraceStep({ ...validStep, layer: 'backend' })).toBe(false)
    expect(isTraceStep({ ...validStep, line: '10' })).toBe(false)
    expect(isTraceStep(null)).toBe(false)
  })
})

describe('isTraceResult', () => {
  it('accepts a well-formed result', () => {
    const result: TraceResult = { rootId: 'x', steps: [validStep], totalSteps: 1 }
    expect(isTraceResult(result)).toBe(true)
  })

  it('accepts an empty-step result', () => {
    expect(isTraceResult({ rootId: 'x', steps: [], totalSteps: 0 })).toBe(true)
  })

  it('rejects when steps contains an invalid step', () => {
    expect(isTraceResult({ rootId: 'x', steps: [{ ...validStep, layer: 'bad' }], totalSteps: 1 })).toBe(false)
  })

  it('rejects non-array steps / wrong types', () => {
    expect(isTraceResult({ rootId: 'x', steps: 'nope', totalSteps: 0 })).toBe(false)
    expect(isTraceResult({ rootId: 1, steps: [], totalSteps: 0 })).toBe(false)
    expect(isTraceResult(null)).toBe(false)
  })
})
