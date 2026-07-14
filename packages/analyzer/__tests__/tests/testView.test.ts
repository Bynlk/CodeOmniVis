import { describe, expect, it } from 'vitest'
import type { OmniGraph } from '@codeomnivis/shared'
import { projectTestView } from '../../src/tests/testView'

const graph: OmniGraph = {
  nodes: [
    {
      id: 'vitest-suite',
      type: 'test_suite',
      name: 'orders',
      filePath: 'orders.test.ts',
      line: 1,
      column: 1,
      metadata: { framework: 'vitest', kind: 'describe' },
    },
    {
      id: 'vitest-case',
      type: 'test_case',
      name: 'orders > creates',
      filePath: 'orders.test.ts',
      line: 2,
      column: 1,
      metadata: { framework: 'vitest', isParameterized: false, disabled: false },
    },
    {
      id: 'jest-case',
      type: 'test_case',
      name: 'users > lists',
      filePath: 'users.test.ts',
      line: 2,
      column: 1,
      metadata: { framework: 'jest', isParameterized: false, disabled: false },
    },
    {
      id: 'fixture',
      type: 'test_fixture',
      name: 'beforeEach',
      filePath: 'orders.test.ts',
      line: 1,
      column: 1,
      metadata: { framework: 'vitest', lifecycle: 'before_each' },
    },
    {
      id: 'orders',
      type: 'service',
      name: 'OrdersService',
      filePath: 'src/orders.ts',
      line: 1,
      column: 1,
      metadata: { className: 'OrdersService', methodName: 'create' },
    },
    {
      id: 'users',
      type: 'service',
      name: 'UsersService',
      filePath: 'src/users.ts',
      line: 1,
      column: 1,
      metadata: { className: 'UsersService', methodName: 'list' },
    },
  ],
  edges: [
    {
      id: 'covers-orders',
      source: 'vitest-case',
      target: 'orders',
      type: 'covers',
      confidence: 'certain',
      metadata: { evidence: 'direct_call' },
    },
    {
      id: 'covers-users',
      source: 'jest-case',
      target: 'users',
      type: 'covers',
      confidence: 'certain',
      metadata: { evidence: 'direct_call' },
    },
  ],
}

describe('projectTestView', () => {
  it('projects test kinds and a framework summary without counting test nodes as targets', () => {
    const view = projectTestView(graph)

    expect(view.suites.map((node) => node.id)).toEqual(['vitest-suite'])
    expect(view.cases.map((node) => node.id)).toEqual(['vitest-case', 'jest-case'])
    expect(view.fixtures.map((node) => node.id)).toEqual(['fixture'])
    expect(view.summary).toMatchObject({
      suites: 1,
      cases: 2,
      fixtures: 1,
      coveredTargets: 2,
      uncoveredTargets: 0,
      byFramework: { vitest: 1, jest: 1 },
    })
  })

  it('filters framework while preserving all framework counters', () => {
    const view = projectTestView(graph, { framework: 'vitest' })
    expect(view.cases.map((node) => node.id)).toEqual(['vitest-case'])
    expect(view.coverage.map((edge) => edge.id)).toEqual(['covers-orders'])
    expect(view.summary.byFramework).toEqual({
      vitest: 1,
      jest: 0,
      playwright: 0,
      cypress: 0,
      junit4: 0,
      junit5: 0,
      kotest: 0,
    })
  })

  it('matches a target by id, name, or file and hides unrelated cases', () => {
    expect(projectTestView(graph, { target: 'orders' }).cases.map((node) => node.id)).toEqual([
      'vitest-case',
    ])
    expect(projectTestView(graph, { target: 'UsersService' }).cases.map((node) => node.id)).toEqual(
      ['jest-case'],
    )
    expect(
      projectTestView(graph, { target: 'src/users.ts' }).coverage.map((edge) => edge.id),
    ).toEqual(['covers-users'])
  })
})
