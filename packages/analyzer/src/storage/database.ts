import * as fs from 'node:fs'
import initSqlJs, {
  type Database as SqlJsDatabase,
  type QueryExecResult,
  type SqlValue,
  type Statement,
} from 'sql.js'
import { CREATE_TABLES_SQL, CURRENT_SCHEMA_VERSION, DROP_CACHE_TABLES_SQL } from './schema'
import { persistDatabaseAtomically } from './persistence'

export interface SqlDatabase {
  run(sql: string, params?: SqlValue[]): void
  exec(sql: string, params?: SqlValue[]): QueryExecResult[]
  prepare(sql: string): Statement
  transaction<T>(operation: () => T): T
  export(): Uint8Array
  persist(): void
  restore(data: Uint8Array): void
  close(): void
}

function schemaVersion(database: SqlJsDatabase): number | null {
  const result = database.exec('SELECT version FROM schema_meta LIMIT 1')
  const value = result[0]?.values[0]?.[0]
  return typeof value === 'number' ? value : null
}

function initializeSchema(database: SqlJsDatabase): void {
  database.run(CREATE_TABLES_SQL)
  const version = schemaVersion(database)
  if (version !== null && version !== CURRENT_SCHEMA_VERSION) {
    database.run(DROP_CACHE_TABLES_SQL)
    database.run(CREATE_TABLES_SQL)
  }
  database.run('DELETE FROM schema_meta')
  database.run('INSERT INTO schema_meta (version) VALUES (?)', [CURRENT_SCHEMA_VERSION])
}

class SqlJsConnection implements SqlDatabase {
  private handle: SqlJsDatabase | null

  constructor(
    private readonly SQL: Awaited<ReturnType<typeof initSqlJs>>,
    private readonly filePath: string,
    handle: SqlJsDatabase,
  ) {
    this.handle = handle
  }

  run(sql: string, params?: SqlValue[]): void {
    this.ensureOpen().run(sql, params)
  }

  exec(sql: string, params?: SqlValue[]): QueryExecResult[] {
    return this.ensureOpen().exec(sql, params)
  }

  prepare(sql: string): Statement {
    return this.ensureOpen().prepare(sql)
  }

  transaction<T>(operation: () => T): T {
    const database = this.ensureOpen()
    database.run('BEGIN IMMEDIATE TRANSACTION')
    try {
      const result = operation()
      database.run('COMMIT')
      return result
    } catch (error) {
      try {
        database.run('ROLLBACK')
      } catch {
        // Preserve the original storage error.
      }
      throw error
    }
  }

  export(): Uint8Array {
    return this.ensureOpen().export()
  }

  persist(): void {
    if (this.filePath !== ':memory:') {
      persistDatabaseAtomically(this.filePath, this.export())
    }
  }

  restore(data: Uint8Array): void {
    this.ensureOpen().close()
    this.handle = new this.SQL.Database(data)
  }

  close(): void {
    const database = this.handle
    if (!database) return
    try {
      this.persist()
    } finally {
      database.close()
      this.handle = null
    }
  }

  private ensureOpen(): SqlJsDatabase {
    if (!this.handle) throw new Error('Database is closed')
    return this.handle
  }
}

export async function openSqlDatabase(filePath = ':memory:'): Promise<SqlDatabase> {
  const SQL = await initSqlJs()
  const data =
    filePath !== ':memory:' && fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined
  const handle = new SQL.Database(data)
  initializeSchema(handle)
  return new SqlJsConnection(SQL, filePath, handle)
}
