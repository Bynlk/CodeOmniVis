import type { SqlValue } from 'sql.js'
import type { SqlDatabase } from './database'
import { SQL } from './schema'

export interface DbStats {
  nodeCount: number
  edgeCount: number
  errorCount: number
  nodeTypeCounts: Record<string, number>
  edgeTypeCounts: Record<string, number>
}

function count(database: SqlDatabase, sql: string): number {
  const value = database.exec(sql)[0]?.values[0]?.[0]
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function grouped(database: SqlDatabase, sql: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of database.exec(sql)[0]?.values ?? []) {
    const key = typeof row[0] === 'string' ? row[0] : String(row[0] ?? '')
    const value: SqlValue | undefined = row[1]
    result[key] = typeof value === 'number' ? value : Number(value ?? 0)
  }
  return result
}

export class StatsRepository {
  constructor(private readonly database: SqlDatabase) {}

  get(): DbStats {
    return {
      nodeCount: count(this.database, SQL.countNodes),
      edgeCount: count(this.database, SQL.countEdges),
      errorCount: count(this.database, SQL.countErrors),
      nodeTypeCounts: grouped(this.database, SQL.nodeTypeCounts),
      edgeTypeCounts: grouped(this.database, SQL.edgeTypeCounts),
    }
  }
}
