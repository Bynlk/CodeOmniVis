import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { OmniGraph } from '@codeomnivis/shared'
import {
  buildTestSuiteGroups,
  filterTestSuiteGroups,
  selectTestGraph,
} from '../../src/lib/testView'
import { TestCanvas } from '../../src/components/Workbench/TestCanvas'
import { TestExplorer } from '../../src/components/Workbench/TestExplorer'

const graph: OmniGraph = {
  nodes: [
    {
      id: 'suite',
      type: 'test_suite',
      name: 'suite',
      filePath: 'a.test.ts',
      line: 1,
      column: 1,
      metadata: { framework: 'vitest', kind: 'describe' },
    },
    {
      id: 'case',
      type: 'test_case',
      name: 'suite > works',
      filePath: 'a.test.ts',
      line: 2,
      column: 1,
      metadata: { framework: 'vitest', isParameterized: false, disabled: false },
    },
    {
      id: 'disabled-case',
      type: 'test_case',
      name: 'suite > skipped',
      filePath: 'a.test.ts',
      line: 3,
      column: 1,
      metadata: { framework: 'vitest', isParameterized: false, disabled: true },
    },
    {
      id: 'fixture',
      type: 'test_fixture',
      name: 'beforeEach',
      filePath: 'a.test.ts',
      line: 1,
      column: 1,
      metadata: { framework: 'vitest', lifecycle: 'before_each' },
    },
    {
      id: 'jest-suite',
      type: 'test_suite',
      name: 'jest suite',
      filePath: 'b.test.ts',
      line: 1,
      column: 1,
      metadata: { framework: 'jest', kind: 'describe' },
    },
    {
      id: 'jest-case',
      type: 'test_case',
      name: 'jest suite > works',
      filePath: 'b.test.ts',
      line: 2,
      column: 1,
      metadata: { framework: 'jest', isParameterized: false, disabled: false },
    },
    {
      id: 'target',
      type: 'service',
      name: 'work',
      filePath: 'src/a.ts',
      line: 1,
      column: 1,
      metadata: { className: null, methodName: 'work' },
    },
  ],
  edges: [
    {
      id: 'tests',
      source: 'suite',
      target: 'case',
      type: 'tests',
      confidence: 'certain',
      metadata: { relation: 'contains_case' },
    },
    {
      id: 'tests-disabled',
      source: 'suite',
      target: 'disabled-case',
      type: 'tests',
      confidence: 'certain',
      metadata: { relation: 'contains_case' },
    },
    {
      id: 'tests-jest',
      source: 'jest-suite',
      target: 'jest-case',
      type: 'tests',
      confidence: 'certain',
      metadata: { relation: 'contains_case' },
    },
    {
      id: 'fixture-use',
      source: 'case',
      target: 'fixture',
      type: 'uses_fixture',
      confidence: 'certain',
      metadata: { usage: 'lexical_scope' },
    },
    {
      id: 'covers',
      source: 'case',
      target: 'target',
      type: 'covers',
      confidence: 'certain',
      metadata: { evidence: 'direct_call' },
    },
  ],
}

describe('test workbench projection', () => {
  it('groups suites and focuses a case coverage path', () => {
    expect(buildTestSuiteGroups(graph)[0].cases.map((node) => node.id)).toEqual([
      'case',
      'disabled-case',
    ])
    expect(selectTestGraph(graph, 'case').edges.map((edge) => edge.id)).toEqual([
      'tests',
      'tests-disabled',
      'tests-jest',
      'fixture-use',
      'covers',
    ])
  })

  it('filters suite groups by framework and enabled/disabled status', () => {
    const groups = buildTestSuiteGroups(graph)

    expect(
      filterTestSuiteGroups(groups, { framework: 'jest', status: 'all' })
        .flatMap((group) => group.cases)
        .map((node) => node.id),
    ).toEqual(['jest-case'])
    expect(
      filterTestSuiteGroups(groups, { framework: 'all', status: 'disabled' })
        .flatMap((group) => group.cases)
        .map((node) => node.id),
    ).toEqual(['disabled-case'])
    expect(
      filterTestSuiteGroups(groups, { framework: 'vitest', status: 'enabled' })
        .flatMap((group) => group.cases)
        .map((node) => node.id),
    ).toEqual(['case'])
  })

  it('renders restrained explorer filters, fixtures, and canvas counters', () => {
    const explorer = renderToStaticMarkup(
      <TestExplorer graph={graph} selectedNodeId="case" onNodeSelect={() => {}} />,
    )
    const canvas = renderToStaticMarkup(
      <TestCanvas graph={graph}>
        <div>graph</div>
      </TestCanvas>,
    )

    expect(explorer).toContain('data-testid="test-explorer"')
    expect(explorer).toContain('Framework')
    expect(explorer).toContain('Status')
    expect(explorer).toContain('beforeEach')
    expect(explorer).toContain('bg-primary-600')
    expect(canvas).toContain('3 cases')
    expect(canvas).toContain('1 targets')
  })
})
