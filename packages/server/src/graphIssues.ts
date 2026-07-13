import {
  AuthDetector,
  ConsistencyChecker,
  NPlusOneDetector,
  RSCBoundaryDetector,
} from '@codeomnivis/analyzer'
import type {
  Issue,
  IssueDetectorId,
  IssueDetectorStatus,
  IssueSource,
  OmniGraph,
  SourcedIssue,
} from '@codeomnivis/shared'

type GraphIssueDetector = (graph: OmniGraph, projectRoot: string) => Issue[]

export interface GraphIssueDetectors {
  consistency: GraphIssueDetector
  auth: GraphIssueDetector
  nPlusOne: GraphIssueDetector
  rsc: GraphIssueDetector
}

export interface GraphIssuesReport {
  issues: SourcedIssue[]
  summary: {
    total: number
    critical: number
    warning: number
    info: number
  }
  detectors: IssueDetectorStatus[]
}

const DETECTOR_ORDER: Array<{
  id: IssueDetectorId
  key: keyof GraphIssueDetectors
  source: IssueSource
}> = [
  { id: 'consistency', key: 'consistency', source: 'consistency' },
  { id: 'auth', key: 'auth', source: 'security' },
  { id: 'n_plus_one', key: 'nPlusOne', source: 'performance' },
  { id: 'rsc', key: 'rsc', source: 'framework' },
]

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const

function createDefaultDetectors(): GraphIssueDetectors {
  return {
    consistency: graph => new ConsistencyChecker().check(graph).issues,
    auth: (graph, projectRoot) => new AuthDetector().detect(graph, projectRoot),
    nPlusOne: (graph, projectRoot) => new NPlusOneDetector().detect(graph, projectRoot),
    rsc: (graph, projectRoot) => new RSCBoundaryDetector().detect(graph, projectRoot),
  }
}

function compareIssues(left: SourcedIssue, right: SourcedIssue): number {
  const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
  if (severity !== 0) return severity

  const leftLocation = left.locations[0]
  const rightLocation = right.locations[0]
  const file = (leftLocation?.file ?? '').localeCompare(rightLocation?.file ?? '')
  if (file !== 0) return file

  const line = (leftLocation?.line ?? 0) - (rightLocation?.line ?? 0)
  return line !== 0 ? line : left.id.localeCompare(right.id)
}

export function collectGraphIssues(
  graph: OmniGraph,
  projectRoot: string,
  detectors: GraphIssueDetectors = createDefaultDetectors(),
): GraphIssuesReport {
  const byId = new Map<string, SourcedIssue>()
  const statuses: IssueDetectorStatus[] = []

  for (const detector of DETECTOR_ORDER) {
    try {
      const issues = detectors[detector.key](graph, projectRoot)
      for (const issue of issues) {
        if (!byId.has(issue.id)) {
          byId.set(issue.id, { ...issue, source: detector.source })
        }
      }
      statuses.push({ id: detector.id, status: 'complete' })
    } catch {
      statuses.push({
        id: detector.id,
        status: 'failed',
        message: 'Detector failed',
      })
    }
  }

  const issues = [...byId.values()].sort(compareIssues)
  return {
    issues,
    summary: {
      total: issues.length,
      critical: issues.filter(issue => issue.severity === 'critical').length,
      warning: issues.filter(issue => issue.severity === 'warning').length,
      info: issues.filter(issue => issue.severity === 'info').length,
    },
    detectors: statuses,
  }
}
