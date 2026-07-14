import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

  it('reads source from disk, supports aliases, and links exact route references', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-linker-'))
    const testPath = 'tests/checkout.test.ts'
    fs.mkdirSync(path.join(root, 'tests'), { recursive: true })
    fs.writeFileSync(path.join(root, testPath), `
      import { checkout as placeOrder } from '../src/checkout'
      placeOrder()
      fetch("/api/orders")
    `)
    const production: OmniNode[] = [
      { id: 'service', type: 'service', name: 'checkout', filePath: 'src/checkout.ts', line: 1, column: 1, metadata: { className: null, methodName: 'checkout' } },
      { id: 'route', type: 'api_route', name: 'GET /api/orders', filePath: 'app/api/orders/route.ts', line: 1, column: 1, metadata: { method: 'GET', route: '/api/orders', isNextApiRoute: true } },
    ]
    const testCase: OmniNode = { id: 'case', type: 'test_case', name: 'checkout', filePath: testPath, line: 3, column: 1, metadata: { framework: 'vitest', isParameterized: false, disabled: false } }
    const existing = { id: 'case--covers--service', source: 'case', target: 'service', type: 'covers' as const, confidence: 'inferred' as const, metadata: { evidence: 'direct_import' as const } }

    try {
      const result = linkTestsToProduction({ nodes: [testCase], edges: [existing], errors: [] }, production, root)
      expect(result.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ target: 'service', confidence: 'certain', metadata: { evidence: 'direct_call' } }),
        expect.objectContaining({ target: 'route', confidence: 'inferred', metadata: { evidence: 'route_reference' } }),
      ]))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('ignores unreadable sources and ambiguous imports', () => {
    const testCase: OmniNode = { id: 'case', type: 'test_case', name: 'missing', filePath: 'missing.test.ts', line: 1, column: 1, metadata: { framework: 'vitest', isParameterized: false, disabled: false } }
    const duplicate: OmniNode[] = [
      { id: 'a', type: 'service', name: 'run', filePath: 'src/run.ts', line: 1, column: 1, metadata: { className: null, methodName: 'run' } },
      { id: 'b', type: 'service', name: 'run', filePath: 'src/run.ts', line: 2, column: 1, metadata: { className: null, methodName: 'run' } },
    ]
    const discovery: ParseResult = { nodes: [testCase], edges: [], errors: [] }
    expect(linkTestsToProduction(discovery, duplicate, '/missing').edges).toEqual([])
    expect(linkTestsToProduction(discovery, duplicate, '/missing', new Map([
      ['missing.test.ts', "import { run } from './src/run'\nrun()"],
    ])).edges).toEqual([])
  })
})
