/**
 * sql.js 类型声明
 *
 * sql.js 官方没有提供完整的 TypeScript 类型定义，
 * 这里提供最基本的类型声明以通过编译。
 */

declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  interface Database {
    run(sql: string, params?: unknown[]): Database
    exec(sql: string, params?: unknown[]): QueryExecResult[]
    prepare(sql: string): Statement
    close(): void
    export(): Uint8Array
  }

  interface Statement {
    bind(params?: unknown[]): boolean
    step(): boolean
    getAsObject(params?: Record<string, unknown>): Record<string, unknown>
    get(params?: unknown): unknown[]
    free(): boolean
    reset(): void
  }

  interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>
}
