import type { SerializableParseError } from '@codeomnivis/shared'
import type { SqlValue } from 'sql.js'
import type { SqlDatabase } from './database'
import { SQL } from './schema'

export interface DbError {
  file: string
  message: string
  severity: 'error' | 'warning' | 'info'
  originalError?: string
}

function stringValue(value: SqlValue | undefined): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

export class ErrorRepository {
  constructor(private readonly database: SqlDatabase) {}

  insert(error: DbError | SerializableParseError): void {
    this.database.run(SQL.insertError, [
      error.file,
      error.message,
      error.severity,
      'originalError' in error ? error.originalError ?? null : null,
    ])
  }

  replaceAll(errors: Array<DbError | SerializableParseError>): number {
    for (const error of errors) this.insert(error)
    return errors.length
  }

  all(): DbError[] {
    const statement = this.database.prepare(SQL.selectAllErrors)
    try {
      const errors: DbError[] = []
      while (statement.step()) {
        const row = statement.getAsObject()
        const severity = stringValue(row.severity)
        const originalError = typeof row.original_error === 'string' ? row.original_error : undefined
        errors.push({
          file: stringValue(row.file),
          message: stringValue(row.message),
          severity: severity === 'error' || severity === 'info' ? severity : 'warning',
          ...(originalError ? { originalError } : {}),
        })
      }
      return errors
    } finally {
      statement.free()
    }
  }

  clear(): void {
    this.database.run(SQL.deleteAllErrors)
  }
}
