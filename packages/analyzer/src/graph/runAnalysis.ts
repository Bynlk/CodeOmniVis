import type { ProjectMeta } from '@codeomnivis/shared'
import type { OmniDatabase } from '../storage/db'
import { analyzeProject } from './analyzeProject'

export interface RunAnalysisOptions {
  projectRoot: string
  dbPath: string
  projectMeta?: ProjectMeta
  db?: OmniDatabase
  onFilesCollected?: (count: number) => void
}

export interface RunAnalysisResult {
  filesScanned: number
  nodesCreated: number
  edgesCreated: number
  crossLayerEdges: number
  errors: number
}

export async function runAnalysis(options: RunAnalysisOptions): Promise<RunAnalysisResult> {
  let filesReported = false
  const result = await analyzeProject({
    projectRoot: options.projectRoot,
    dbPath: options.dbPath,
    db: options.db,
    projectMeta: options.projectMeta,
    onProgress: (event) => {
      if (!filesReported && event.filesScanned !== undefined) {
        filesReported = true
        options.onFilesCollected?.(event.filesScanned)
      }
    },
  })
  const graph = result.snapshot.graph
  const crossLayerTypes = new Set(['calls_api', 'handles', 'calls_service', 'queries_db'])
  return {
    filesScanned: result.snapshot.stats.filesScanned,
    nodesCreated: graph.nodes.length,
    edgesCreated: graph.edges.length,
    crossLayerEdges: graph.edges.filter((edge) => crossLayerTypes.has(edge.type)).length,
    errors: result.snapshot.parseErrors.length,
  }
}
