import type { AnalysisStats, Issue, OmniGraph, SerializableParseError } from '@codeomnivis/shared'

export function createAnalysisStats(
  filesScanned: number,
  graph: OmniGraph,
  issues: Issue[],
  parseErrors: SerializableParseError[],
): AnalysisStats {
  const nodeTypeCounts: AnalysisStats['nodeTypeCounts'] = {}
  const edgeTypeCounts: AnalysisStats['edgeTypeCounts'] = {}
  for (const node of graph.nodes) nodeTypeCounts[node.type] = (nodeTypeCounts[node.type] ?? 0) + 1
  for (const edge of graph.edges) edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] ?? 0) + 1
  return {
    filesScanned,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    issueCount: issues.length,
    parseErrorCount: parseErrors.length,
    nodeTypeCounts,
    edgeTypeCounts,
    issueSeverityCounts: {
      critical: issues.filter((issue) => issue.severity === 'critical').length,
      warning: issues.filter((issue) => issue.severity === 'warning').length,
      info: issues.filter((issue) => issue.severity === 'info').length,
    },
    parseErrorSeverityCounts: {
      error: parseErrors.filter((error) => error.severity === 'error').length,
      warning: parseErrors.filter((error) => error.severity === 'warning').length,
      info: parseErrors.filter((error) => error.severity === 'info').length,
    },
  }
}
