import type { OmniGraph, ProjectSnapshot, WriteReport } from '@codeomnivis/shared'
import { AnalysisError } from '../graph/analysisError'
import type { DbError } from './db'

export interface AnalysisStore {
  ready(): Promise<void>
  loadGraph(): OmniGraph
  getAllErrors(): DbError[]
  clearGraph(): boolean
  saveGraph(graph: OmniGraph): { nodesSaved: number; edgesSaved: number }
  insertErrors(errors: DbError[]): number
  close(): void
}

function rollback(store: AnalysisStore, graph: OmniGraph, errors: DbError[]): boolean {
  if (!store.clearGraph()) return false
  const restored = store.saveGraph(graph)
  const restoredErrors = store.insertErrors(errors)
  return restored.nodesSaved === graph.nodes.length
    && restored.edgesSaved === graph.edges.length
    && restoredErrors === errors.length
}

export function replaceLegacySnapshot(
  store: AnalysisStore,
  snapshot: ProjectSnapshot,
): WriteReport {
  const previousGraph = store.loadGraph()
  const previousErrors = store.getAllErrors()
  try {
    if (!store.clearGraph()) throw new Error('clear failed')
    const saved = store.saveGraph(snapshot.graph)
    if (
      saved.nodesSaved !== snapshot.graph.nodes.length
      || saved.edgesSaved !== snapshot.graph.edges.length
    ) {
      throw new Error('graph write was incomplete')
    }
    const errorsWritten = store.insertErrors(snapshot.parseErrors)
    if (errorsWritten !== snapshot.parseErrors.length) throw new Error('error write was incomplete')
    return {
      committed: true,
      nodes: { attempted: snapshot.graph.nodes.length, written: saved.nodesSaved, rejected: 0 },
      edges: { attempted: snapshot.graph.edges.length, written: saved.edgesSaved, rejected: 0 },
      errors: { written: errorsWritten },
      rejectedEdges: [],
    }
  } catch (cause) {
    const restored = rollback(store, previousGraph, previousErrors)
    throw new AnalysisError(
      'STORAGE_FAILURE',
      restored ? 'Snapshot persistence failed; the previous snapshot was restored'
        : 'Snapshot persistence failed and rollback was incomplete',
      { cause },
    )
  }
}
