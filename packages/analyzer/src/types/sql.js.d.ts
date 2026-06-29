/**
 * sql.js 类型声明
 *
 * sql.js 官方没有提供完整的 TypeScript 类型定义，
 * 这里提供最基本的类型声明以通过编译。
 */

declare module 'sql.js' {
  type SqlValue = string | number | Uint8Array | null

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  interface Database {
    run(sql: string, params?: SqlValue[]): Database
    exec(sql: string, params?: SqlValue[]): QueryExecResult[]
    prepare(sql: string): Statement
    close(): void
    export(): Uint8Array
  }

  interface Statement {
    bind(params?: SqlValue[]): boolean
    step(): boolean
    getAsObject(params?: Record<string, SqlValue>): Record<string, SqlValue>
    get(params?: SqlValue | Record<string, SqlValue>): SqlValue[]
    free(): boolean
    reset(): void
  }

  interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>
}
