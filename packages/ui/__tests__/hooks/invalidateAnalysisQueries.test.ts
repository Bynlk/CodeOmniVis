import { describe, expect, it, vi } from 'vitest'
import { invalidateAnalysisQueries } from '../../src/hooks/invalidateAnalysisQueries'

describe('invalidateAnalysisQueries', () => {
  it('invalidates graph, stats, parser errors, project issues, and freshness', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)

    await invalidateAnalysisQueries({ invalidateQueries })

    expect(invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)).toEqual([
      ['graph'],
      ['graph-stats'],
      ['graph-errors'],
      ['graph-issues'],
      ['status'],
    ])
  })
})
