import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Issue, SerializableParseError } from '@codeomnivis/shared'
import { detectAnalysisIssues } from '../../src/graph/analysisIssues'
import { ConsistencyChecker } from '../../src/graph/consistency'
import { AuthDetector } from '../../src/resolver/authDetector'
import { NPlusOneDetector } from '../../src/resolver/nPlusOneDetector'
import { RSCBoundaryDetector } from '../../src/resolver/rscBoundaryDetector'

const issue = (id: string): Issue => ({
  id,
  type: 'unused_route',
  severity: 'info',
  description: id,
  locations: [],
  relatedNodeIds: [],
  relatedEdgeIds: [],
})

afterEach(() => { vi.restoreAllMocks() })

describe('detectAnalysisIssues', () => {
  it('deduplicates and sorts results from independent detectors', () => {
    vi.spyOn(ConsistencyChecker.prototype, 'check').mockReturnValue({ issues: [issue('z'), issue('a')], summary: { total: 2, critical: 0, warning: 0, info: 2 } })
    vi.spyOn(NPlusOneDetector.prototype, 'detect').mockReturnValue([issue('a')])
    vi.spyOn(AuthDetector.prototype, 'detect').mockReturnValue([])
    vi.spyOn(RSCBoundaryDetector.prototype, 'detect').mockReturnValue([])

    expect(detectAnalysisIssues({ nodes: [], edges: [] }, '/project', []).map(item => item.id))
      .toEqual(['a', 'z'])
  })

  it('degrades one detector failure without suppressing the others', () => {
    const errors: SerializableParseError[] = []
    vi.spyOn(ConsistencyChecker.prototype, 'check').mockImplementation(() => { throw new Error('broken') })
    vi.spyOn(NPlusOneDetector.prototype, 'detect').mockReturnValue([issue('kept')])
    vi.spyOn(AuthDetector.prototype, 'detect').mockReturnValue([])
    vi.spyOn(RSCBoundaryDetector.prototype, 'detect').mockReturnValue([])

    expect(detectAnalysisIssues({ nodes: [], edges: [] }, '/project', errors).map(item => item.id))
      .toEqual(['kept'])
    expect(errors).toEqual([
      expect.objectContaining({ parser: 'consistency', severity: 'warning', code: 'ISSUE_DETECTOR_FAILED' }),
    ])
  })
})
