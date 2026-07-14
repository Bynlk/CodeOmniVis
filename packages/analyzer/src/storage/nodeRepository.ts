import type { JsonObject, NodeType, OmniNode } from '@codeomnivis/shared'
import { isNodeType, jsonObjectOrEmpty } from '@codeomnivis/shared'
import type { SqlValue } from 'sql.js'
import { parseStoredNode } from './metadataGuards'
import type { SqlDatabase } from './database'
import { SQL } from './schema'

function stringValue(value: SqlValue | undefined): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function numberValue(value: SqlValue | undefined): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function metadata(value: SqlValue | undefined): JsonObject {
  if (typeof value !== 'string') return {}
  try {
    return jsonObjectOrEmpty(JSON.parse(value))
  } catch {
    return {}
  }
}

function rowToNode(row: Record<string, SqlValue>): OmniNode {
  const storedType = stringValue(row.type)
  return parseStoredNode(
    {
      id: stringValue(row.id),
      name: stringValue(row.name),
      filePath: stringValue(row.file_path),
      line: numberValue(row.line),
      column: numberValue(row.column),
    },
    isNodeType(storedType) ? storedType : 'module',
    metadata(row.metadata),
  )
}

export class NodeRepository {
  constructor(private readonly database: SqlDatabase) {}

  upsert(node: OmniNode): void {
    this.database.run(SQL.insertNode, [
      node.id,
      node.type,
      node.name,
      node.filePath,
      node.line,
      node.column,
      JSON.stringify(node.metadata),
    ])
  }

  replaceAll(nodes: OmniNode[]): number {
    for (const node of nodes) this.upsert(node)
    return nodes.length
  }

  get(id: string): OmniNode | null {
    return this.first(SQL.selectNode, [id])
  }

  all(): OmniNode[] {
    return this.select(SQL.selectAllNodes)
  }

  byType(type: NodeType): OmniNode[] {
    return this.select(SQL.selectNodesByType, [type])
  }

  byFile(filePath: string): OmniNode[] {
    return this.select(SQL.selectNodesByFile, [filePath])
  }

  byTypes(types: NodeType[]): OmniNode[] {
    if (types.length === 0) return []
    return this.select(
      `SELECT * FROM nodes WHERE type IN (${types.map(() => '?').join(',')})`,
      types,
    )
  }

  findByRoute(route: string): OmniNode | null {
    return this.first(`SELECT * FROM nodes WHERE json_extract(metadata, '$.route') = ? LIMIT 1`, [route])
  }

  findByFilePath(filePath: string): OmniNode | null {
    return this.first('SELECT * FROM nodes WHERE file_path = ? LIMIT 1', [filePath])
  }

  findByName(name: string): OmniNode | null {
    return this.first('SELECT * FROM nodes WHERE name = ? LIMIT 1', [name])
  }

  delete(id: string): void {
    this.database.run(SQL.deleteNode, [id])
  }

  clear(): void {
    this.database.run(SQL.deleteAllNodes)
  }

  private first(sql: string, params: SqlValue[] = []): OmniNode | null {
    return this.select(sql, params)[0] ?? null
  }

  private select(sql: string, params: SqlValue[] = []): OmniNode[] {
    const statement = this.database.prepare(sql)
    try {
      statement.bind(params)
      const nodes: OmniNode[] = []
      while (statement.step()) nodes.push(rowToNode(statement.getAsObject()))
      return nodes
    } finally {
      statement.free()
    }
  }
}
