import type { ProjectMeta } from '@codeomnivis/shared'
import { analyzeProject } from './analyzeProject'

export interface FullAnalysisOptions {
  projectRoot: string
  dbPath: string
}

export interface FullAnalysisResult {
  filesScanned: number
  nodesCreated: number
  edgesCreated: number
  crossLayerEdges: number
  errors: number
  projectMeta: ProjectMeta
}

export async function runFullAnalysis(options: FullAnalysisOptions): Promise<FullAnalysisResult> {
  const result = await analyzeProject(options)
  const graph = result.snapshot.graph
  const crossLayerTypes = new Set(['calls_api', 'handles', 'calls_service', 'queries_db'])
  return {
    filesScanned: result.snapshot.stats.filesScanned,
    nodesCreated: graph.nodes.length,
    edgesCreated: graph.edges.length,
    crossLayerEdges: graph.edges.filter(edge => crossLayerTypes.has(edge.type)).length,
    errors: result.snapshot.parseErrors.length,
    projectMeta: result.snapshot.project.meta,
  }
}
