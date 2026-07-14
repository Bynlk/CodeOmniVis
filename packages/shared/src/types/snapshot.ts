import type { EdgeType } from './edge'
import type { FreshnessStatus } from './freshness'
import type { OmniGraph, ProjectMeta } from './graph'
import type { Issue, IssueSeverity } from './issue'
import type { NodeType } from './node'

export type ParseErrorSeverity = 'error' | 'warning' | 'info'

export interface SerializableParseError {
  file: string
  message: string
  severity: ParseErrorSeverity
  parser?: string
  code?: string
}

export interface AnalysisStats {
  filesScanned: number
  nodeCount: number
  edgeCount: number
  issueCount: number
  parseErrorCount: number
  nodeTypeCounts: Partial<Record<NodeType, number>>
  edgeTypeCounts: Partial<Record<EdgeType, number>>
  issueSeverityCounts: Record<IssueSeverity, number>
  parseErrorSeverityCounts: Record<ParseErrorSeverity, number>
}

export interface TestRunCaseResult {
  suite: string
  name: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  failureMessage?: string
}

export interface TestRunImport {
  source: 'junit_xml'
  importedAt: number
  cases: TestRunCaseResult[]
  unmatched: TestRunCaseResult[]
}

export interface ProjectSnapshot {
  schemaVersion: 1
  snapshotId: string
  snapshotDigest: string
  project: {
    root: string
    fingerprint: string
    meta: ProjectMeta
  }
  graph: OmniGraph
  issues: Issue[]
  parseErrors: SerializableParseError[]
  stats: AnalysisStats
  freshness: FreshnessStatus
  provenance: {
    generatedAt: number
    analyzerVersion: string
    filesScanned: number
    sourceDigest: string
    testRuns?: TestRunImport[]
  }
}

export interface RejectedEdge {
  edgeId: string
  reason: 'missing_source' | 'missing_target' | 'invalid_metadata'
}

export interface WriteReport {
  committed: boolean
  nodes: { attempted: number; written: number; rejected: number }
  edges: { attempted: number; written: number; rejected: number }
  errors: { written: number }
  rejectedEdges: RejectedEdge[]
}

export interface AnalyzeProjectResult {
  snapshot: ProjectSnapshot
  writeReport: WriteReport
}
