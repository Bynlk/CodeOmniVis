import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { OmniEdge, ProjectSnapshot, RejectedEdge, WriteReport } from '@codeomnivis/shared'
import { computeSnapshotDigest } from '@codeomnivis/shared/node'
import type { SqlDatabase } from './database'
import type { ErrorRepository } from './errorRepository'
import type { GraphRepository } from './graphRepository'
import type { NodeRepository } from './nodeRepository'
import type { StatsRepository } from './statsRepository'

export function persistDatabaseAtomically(filePath: string, data: Uint8Array): void {
  const directory = path.dirname(filePath)
  fs.mkdirSync(directory, { recursive: true })
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`)
  try {
    fs.writeFileSync(temporary, Buffer.from(data), { mode: 0o600 })
    const file = fs.openSync(temporary, 'r')
    try {
      fs.fsyncSync(file)
    } finally {
      fs.closeSync(file)
    }
    fs.renameSync(temporary, filePath)
  } catch (error) {
    try {
      fs.unlinkSync(temporary)
    } catch {
      // The temporary file may not have been created.
    }
    throw error
  }
}

interface EdgeWriter {
  replaceAll(edges: OmniEdge[]): number
}

export interface Repositories {
  database: SqlDatabase
  nodes: NodeRepository
  edges: EdgeWriter
  errors: ErrorRepository
  graph: GraphRepository
  stats: StatsRepository
}

function classifyEdges(snapshot: ProjectSnapshot): {
  accepted: OmniEdge[]
  rejected: RejectedEdge[]
} {
  const nodeIds = new Set(snapshot.graph.nodes.map(node => node.id))
  const accepted: OmniEdge[] = []
  const rejected: RejectedEdge[] = []
  for (const edge of snapshot.graph.edges) {
    let reason: RejectedEdge['reason'] | undefined
    if (!nodeIds.has(edge.source)) reason = 'missing_source'
    else if (!nodeIds.has(edge.target)) reason = 'missing_target'
    else {
      try {
        if (JSON.stringify(edge.metadata) === undefined) reason = 'invalid_metadata'
      } catch {
        reason = 'invalid_metadata'
      }
    }
    if (reason) rejected.push({ edgeId: edge.id, reason })
    else accepted.push(edge)
  }
  return { accepted, rejected }
}

function committedSnapshot(snapshot: ProjectSnapshot, edges: OmniEdge[]): ProjectSnapshot {
  if (edges.length === snapshot.graph.edges.length) return snapshot
  const edgeTypeCounts: ProjectSnapshot['stats']['edgeTypeCounts'] = {}
  for (const edge of edges) edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] ?? 0) + 1
  const projected: ProjectSnapshot = {
    ...snapshot,
    graph: { nodes: [...snapshot.graph.nodes], edges },
    stats: { ...snapshot.stats, edgeCount: edges.length, edgeTypeCounts },
    snapshotDigest: '',
  }
  projected.snapshotDigest = computeSnapshotDigest(projected)
  return projected
}

export function replaceSnapshot(
  snapshot: ProjectSnapshot,
  repositories: Repositories,
): WriteReport {
  const { database, nodes, edges, errors, graph } = repositories
  const previous = database.export()
  const { accepted, rejected } = classifyEdges(snapshot)
  const projected = committedSnapshot(snapshot, accepted)

  const report = database.transaction(() => {
    graph.clear()
    const nodesWritten = nodes.replaceAll(projected.graph.nodes)
    const edgesWritten = edges.replaceAll(projected.graph.edges)
    const errorsWritten = errors.replaceAll(projected.parseErrors)
    graph.saveSnapshot(projected)
    return {
      committed: true,
      nodes: {
        attempted: snapshot.graph.nodes.length,
        written: nodesWritten,
        rejected: snapshot.graph.nodes.length - nodesWritten,
      },
      edges: {
        attempted: snapshot.graph.edges.length,
        written: edgesWritten,
        rejected: rejected.length,
      },
      errors: { written: errorsWritten },
      rejectedEdges: rejected,
    } satisfies WriteReport
  })

  try {
    database.persist()
  } catch (error) {
    database.restore(previous)
    throw error
  }
  return report
}
