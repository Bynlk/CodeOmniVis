import { describe, expect, it } from 'vitest'
import { createTypedEdge, createTypedNode, isEdgeType, isNodeOfType } from '../../src'

describe('typed test graph contracts', () => {
  it('round-trips a parameterized JUnit case', () => {
    const node = createTypedNode({
      id: 'test_case:src/test/CheckoutTest.kt:CheckoutTest > rejectsExpiredCard',
      type: 'test_case',
      name: 'CheckoutTest > rejectsExpiredCard',
      filePath: 'src/test/CheckoutTest.kt',
      line: 18,
      column: 3,
      metadata: {
        framework: 'junit5',
        isParameterized: true,
        parameterSource: 'expiredCards',
        disabled: false,
      },
    })
    expect(isNodeOfType(node, 'test_case')).toBe(true)
  })

  it('keeps coverage evidence typed', () => {
    const edge = createTypedEdge({
      id: 'case--covers--service',
      source: 'case',
      target: 'service',
      type: 'covers',
      confidence: 'certain',
      metadata: { evidence: 'direct_call' },
    })
    expect(isEdgeType(edge.type)).toBe(true)
  })
})
