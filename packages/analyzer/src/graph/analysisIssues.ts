import type { Issue, OmniGraph, SerializableParseError } from '@codeomnivis/shared'
import { AuthDetector } from '../resolver/authDetector'
import { NPlusOneDetector } from '../resolver/nPlusOneDetector'
import { RSCBoundaryDetector } from '../resolver/rscBoundaryDetector'
import { ConsistencyChecker } from './consistency'

function detectorWarning(detector: string): SerializableParseError {
  return {
    file: '<project>',
    message: `${detector} issue detection failed; remaining analysis is available`,
    severity: 'warning',
    parser: detector,
    code: 'ISSUE_DETECTOR_FAILED',
  }
}

function runIssueDetector(
  name: string,
  operation: () => Issue[],
  parseErrors: SerializableParseError[],
): Issue[] {
  try {
    return operation()
  } catch {
    parseErrors.push(detectorWarning(name))
    return []
  }
}

export function detectAnalysisIssues(
  graph: OmniGraph,
  projectRoot: string,
  parseErrors: SerializableParseError[],
): Issue[] {
  const issues = [
    ...runIssueDetector(
      'consistency',
      () => new ConsistencyChecker().check(graph).issues,
      parseErrors,
    ),
    ...runIssueDetector(
      'n_plus_one',
      () => new NPlusOneDetector().detect(graph, projectRoot),
      parseErrors,
    ),
    ...runIssueDetector('auth', () => new AuthDetector().detect(graph, projectRoot), parseErrors),
    ...runIssueDetector(
      'rsc',
      () => new RSCBoundaryDetector().detect(graph, projectRoot),
      parseErrors,
    ),
  ]
  return [...new Map(issues.map((issue) => [issue.id, issue])).values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )
}
