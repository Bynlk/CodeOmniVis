import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  IssueDetectorId,
  IssueDetectorStatus,
  IssueMessageKey,
  IssueSource,
  SourcedIssue,
} from '../../src'

describe('sourced issue contract', () => {
  it('describes a detector finding with its product source', () => {
    const source: IssueSource = 'security'
    const detector: IssueDetectorId = 'auth'
    const messageKey: IssueMessageKey = 'unguarded_route'
    const status: IssueDetectorStatus = { id: detector, status: 'complete' }
    const issue: SourcedIssue = {
      id: 'auth-handler:app/api/user/route.ts:GET',
      source,
      severity: 'critical',
      type: 'unguarded_route',
      description: 'API route has no authentication guard',
      messageKey,
      messageParams: { route: 'GET /api/user' },
      locations: [{ file: 'app/api/user/route.ts', line: 4 }],
      relatedNodeIds: ['handler:app/api/user/route.ts:GET'],
      relatedEdgeIds: [],
    }

    expect(status).toEqual({ id: 'auth', status: 'complete' })
    expect(issue.source).toBe('security')
    expect(issue.messageKey).toBe('unguarded_route')
    expect(issue.messageParams).toEqual({ route: 'GET /api/user' })
    expectTypeOf(issue).toMatchTypeOf<SourcedIssue>()
  })
})
