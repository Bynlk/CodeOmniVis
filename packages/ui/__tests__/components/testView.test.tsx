import { describe, expect, it } from 'vitest'
import type { OmniGraph } from '@codeomnivis/shared'
import { buildTestSuiteGroups, selectTestGraph } from '../../src/lib/testView'

const graph: OmniGraph = {
  nodes: [
    { id: 'suite', type: 'test_suite', name: 'suite', filePath: 'a.test.ts', line: 1, column: 1, metadata: { framework: 'vitest', kind: 'describe' } },
    { id: 'case', type: 'test_case', name: 'suite > works', filePath: 'a.test.ts', line: 2, column: 1, metadata: { framework: 'vitest', isParameterized: false, disabled: false } },
    { id: 'target', type: 'service', name: 'work', filePath: 'src/a.ts', line: 1, column: 1, metadata: { className: null, methodName: 'work' } },
  ],
  edges: [
    { id: 'tests', source: 'suite', target: 'case', type: 'tests', confidence: 'certain', metadata: { relation: 'contains_case' } },
    { id: 'covers', source: 'case', target: 'target', type: 'covers', confidence: 'certain', metadata: { evidence: 'direct_call' } },
  ],
}

describe('test workbench projection', () => {
  it('groups suites and focuses a case coverage path', () => {
    expect(buildTestSuiteGroups(graph)[0].cases.map(node => node.id)).toEqual(['case'])
    expect(selectTestGraph(graph, 'case').edges.map(edge => edge.id)).toEqual(['tests', 'covers'])
  })
})
