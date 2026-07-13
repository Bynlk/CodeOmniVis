import { describe, expect, it } from 'vitest'
import type { Issue, OmniGraph } from '@codeomnivis/shared'
import {
  collectGraphIssues,
  type GraphIssueDetectors,
} from '../src/graphIssues'

const EMPTY_GRAPH: OmniGraph = { nodes: [], edges: [] }

function makeIssue(overrides: Partial<Issue> & Pick<Issue, 'id' | 'severity' | 'type'>): Issue {
  return {
    description: overrides.id,
    locations: [{ file: 'src/example.ts', line: 1 }],
    relatedNodeIds: [],
    relatedEdgeIds: [],
    ...overrides,
  }
}

function makeDetectors(overrides: Partial<GraphIssueDetectors> = {}): GraphIssueDetectors {
  return {
    consistency: () => [],
    auth: () => [],
    nPlusOne: () => [],
    rsc: () => [],
    ...overrides,
  }
}

describe('collectGraphIssues', () => {
  it('labels, de-duplicates, and severity-sorts detector findings', () => {
    const duplicate = makeIssue({ id: 'duplicate', severity: 'warning', type: 'dead_route' })
    const report = collectGraphIssues(EMPTY_GRAPH, '/project', makeDetectors({
      consistency: () => [
        makeIssue({ id: 'info', severity: 'info', type: 'unused_route' }),
        duplicate,
      ],
      auth: () => [
        makeIssue({ id: 'critical', severity: 'critical', type: 'unguarded_route' }),
        duplicate,
      ],
    }))

    expect(report.issues.map(issue => issue.id)).toEqual(['critical', 'duplicate', 'info'])
    expect(report.issues.map(issue => issue.source)).toEqual(['security', 'consistency', 'consistency'])
  })

  it('keeps successful findings when one detector fails', () => {
    const report = collectGraphIssues(EMPTY_GRAPH, '/project', makeDetectors({
      consistency: () => [makeIssue({ id: 'kept', severity: 'warning', type: 'dead_route' })],
      auth: () => { throw new Error('auth source unavailable') },
    }))

    expect(report.issues.map(issue => issue.id)).toEqual(['kept'])
    expect(report.detectors).toContainEqual({
      id: 'auth',
      status: 'failed',
      message: 'Detector failed',
    })
    expect(JSON.stringify(report.detectors)).not.toContain('auth source unavailable')
  })

  it('returns deterministic summary and detector statuses', () => {
    const report = collectGraphIssues(EMPTY_GRAPH, '/project', makeDetectors({
      auth: () => [makeIssue({ id: 'critical', severity: 'critical', type: 'unguarded_route' })],
      consistency: () => [makeIssue({ id: 'warning', severity: 'warning', type: 'dead_route' })],
      rsc: () => [makeIssue({ id: 'info', severity: 'info', type: 'rsc_boundary_violation' })],
    }))

    expect(report.summary).toEqual({ total: 3, critical: 1, warning: 1, info: 1 })
    expect(report.detectors).toEqual([
      { id: 'consistency', status: 'complete' },
      { id: 'auth', status: 'complete' },
      { id: 'n_plus_one', status: 'complete' },
      { id: 'rsc', status: 'complete' },
    ])
  })
})
