import { describe, expect, it } from 'vitest'
import type { OmniNode, ParseResult } from '@codeomnivis/shared'
import { linkTestsToProduction } from '../../src/tests/testLinker'

describe('testLinker', () => {
  it('links a directly called import with certain evidence and no dangling endpoints', () => {
    const production: OmniNode = { id: 'service:src/checkout.ts:checkout', type: 'service', name: 'checkout', filePath: 'src/checkout.ts', line: 1, column: 1, metadata: { className: null, methodName: 'checkout' } }
    const testCase: OmniNode = { id: 'test_case:tests/checkout.test.ts:checkout', type: 'test_case', name: 'checkout', filePath: 'tests/checkout.test.ts', line: 3, column: 1, metadata: { framework: 'vitest', isParameterized: false, disabled: false } }
    const discovery: ParseResult = { nodes: [testCase], edges: [], errors: [] }
    const result = linkTestsToProduction(discovery, [production], '/fixture', new Map([
      ['tests/checkout.test.ts', "import { checkout } from '../src/checkout'\ncheckout()"],
    ]))

    expect(result.edges).toEqual([expect.objectContaining({ type: 'covers', confidence: 'certain', metadata: { evidence: 'direct_call' } })])
    expect(result.edges.every(edge => [testCase.id, production.id].includes(edge.source) && [testCase.id, production.id].includes(edge.target))).toBe(true)
  })
})
