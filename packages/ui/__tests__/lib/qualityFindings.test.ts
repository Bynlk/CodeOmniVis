import { describe, expect, it } from 'vitest'
import type { SourcedIssue } from '@codeomnivis/shared'
import type { ParseError } from '../../src/services'
import { mergeQualityFindings } from '../../src/lib/qualityFindings'

const parserErrors: ParseError[] = [
  { file: 'z-parser.ts', message: 'Parser recovered', severity: 'error' },
]

const projectIssues: SourcedIssue[] = [
  {
    id: 'warning-route',
    source: 'consistency',
    severity: 'warning',
    type: 'dead_route',
    description: 'Route has no callers',
    locations: [{ file: 'b-route.ts', line: 8 }],
    relatedNodeIds: [],
    relatedEdgeIds: [],
  },
  {
    id: 'critical-auth',
    source: 'security',
    severity: 'critical',
    type: 'unguarded_route',
    description: 'Route has no authentication guard',
    locations: [{ file: 'a-auth.ts', line: 4 }],
    relatedNodeIds: [],
    relatedEdgeIds: [],
  },
]

describe('mergeQualityFindings', () => {
  it('combines parser and project findings in severity order', () => {
    const findings = mergeQualityFindings(parserErrors, projectIssues)

    expect(findings.map(finding => finding.severity)).toEqual(['critical', 'error', 'warning'])
    expect(findings.map(finding => finding.source)).toEqual(['security', 'parser', 'consistency'])
    expect(findings[0]).toMatchObject({ type: 'unguarded_route', message: 'Route has no authentication guard' })
    expect(findings[1]).toMatchObject({ type: 'parser', locations: [{ file: 'z-parser.ts' }] })
  })

  it('returns stable IDs for repeated input', () => {
    const first = mergeQualityFindings(parserErrors, projectIssues)
    const second = mergeQualityFindings(parserErrors, projectIssues)

    expect(second.map(finding => finding.id)).toEqual(first.map(finding => finding.id))
  })
})
