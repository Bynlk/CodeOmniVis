import type {
  IssueLocation,
  IssueMessageKey,
  IssueMessageParams,
  IssueSource,
  SourcedIssue,
} from '@codeomnivis/shared'
import type { ParseError } from '../services'

export type QualitySeverity = 'critical' | 'error' | 'warning' | 'info'
export type QualitySource = 'parser' | IssueSource

export interface QualityFinding {
  id: string
  source: QualitySource
  severity: QualitySeverity
  type: 'parser' | SourcedIssue['type']
  message: string
  messageKey?: IssueMessageKey
  messageParams?: IssueMessageParams
  locations: IssueLocation[]
  relatedNodeIds: string[]
}

const SEVERITY_RANK: Record<QualitySeverity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
}

function parserFinding(error: ParseError): QualityFinding {
  return {
    id: `parser:${error.file}:${error.severity}:${error.message}`,
    source: 'parser',
    severity: error.severity,
    type: 'parser',
    message: error.message,
    locations: [{ file: error.file }],
    relatedNodeIds: [],
  }
}

function projectFinding(issue: SourcedIssue): QualityFinding {
  return {
    id: `issue:${issue.id}`,
    source: issue.source,
    severity: issue.severity,
    type: issue.type,
    message: issue.description,
    messageKey: issue.messageKey,
    messageParams: issue.messageParams,
    locations: issue.locations,
    relatedNodeIds: issue.relatedNodeIds,
  }
}

function compareFindings(left: QualityFinding, right: QualityFinding): number {
  const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
  if (severity !== 0) return severity

  const leftLocation = left.locations[0]
  const rightLocation = right.locations[0]
  const file = (leftLocation?.file ?? '').localeCompare(rightLocation?.file ?? '')
  if (file !== 0) return file

  const line = (leftLocation?.line ?? 0) - (rightLocation?.line ?? 0)
  return line !== 0 ? line : left.id.localeCompare(right.id)
}

export function mergeQualityFindings(
  parserErrors: ParseError[] = [],
  projectIssues: SourcedIssue[] = [],
): QualityFinding[] {
  return [
    ...parserErrors.map(parserFinding),
    ...projectIssues.map(projectFinding),
  ].sort(compareFindings)
}
