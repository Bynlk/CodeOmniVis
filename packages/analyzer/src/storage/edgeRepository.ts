import type { EdgeType, JsonObject, OmniEdge } from '@codeomnivis/shared'
import { isEdgeType, jsonObjectOrEmpty } from '@codeomnivis/shared'
import type { SqlValue } from 'sql.js'
import { parseStoredEdge } from './metadataGuards'
import type { SqlDatabase } from './database'
import { SQL } from './schema'

function stringValue(value: SqlValue | undefined): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function metadata(value: SqlValue | undefined): JsonObject {
  if (typeof value !== 'string') return {}
  try {
    return jsonObjectOrEmpty(JSON.parse(value))
  } catch {
    return {}
  }
}

function rowToEdge(row: Record<string, SqlValue>): OmniEdge {
  const storedType = stringValue(row.type)
  const confidence = stringValue(row.confidence)
  return parseStoredEdge(
    {
      id: stringValue(row.id),
      source: stringValue(row.source),
      target: stringValue(row.target),
      confidence: confidence === 'certain' ? 'certain' : 'inferred',
    },
    isEdgeType(storedType) ? storedType : 'imports',
    metadata(row.metadata),
  )
}

export class EdgeRepository {
  constructor(private readonly database: SqlDatabase) {}

  upsert(edge: OmniEdge): void {
    this.database.run(SQL.insertEdge, [
      edge.id,
      edge.source,
      edge.target,
      edge.type,
      edge.confidence,
      JSON.stringify(edge.metadata),
    ])
  }

  replaceAll(edges: OmniEdge[]): number {
    for (const edge of edges) this.upsert(edge)
    return edges.length
  }

  get(id: string): OmniEdge | null {
    return this.first(SQL.selectEdge, [id])
  }

  all(): OmniEdge[] {
    return this.select(SQL.selectAllEdges)
  }

  byType(type: EdgeType): OmniEdge[] {
    return this.select(SQL.selectEdgesByType, [type])
  }

  outgoing(nodeId: string): OmniEdge[] {
    return this.select(SQL.selectEdgesBySource, [nodeId])
  }

  incoming(nodeId: string): OmniEdge[] {
    return this.select(SQL.selectEdgesByTarget, [nodeId])
  }

  delete(id: string): void {
    this.database.run(SQL.deleteEdge, [id])
  }

  clear(): void {
    this.database.run(SQL.deleteAllEdges)
  }

  removeDangling(): number {
    const before = this.all().length
    this.database.run(
      'DELETE FROM edges WHERE source NOT IN (SELECT id FROM nodes) OR target NOT IN (SELECT id FROM nodes)',
    )
    return before - this.all().length
  }

  private first(sql: string, params: SqlValue[] = []): OmniEdge | null {
    return this.select(sql, params)[0] ?? null
  }

  private select(sql: string, params: SqlValue[] = []): OmniEdge[] {
    const statement = this.database.prepare(sql)
    try {
      statement.bind(params)
      const edges: OmniEdge[] = []
      while (statement.step()) edges.push(rowToEdge(statement.getAsObject()))
      return edges
    } finally {
      statement.free()
    }
  }
}
