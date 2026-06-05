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
    run(sql: string, params?: any[]): Database
    exec(sql: string, params?: any[]): QueryExecResult[]
    prepare(sql: string): Statement
    close(): void
    export(): Uint8Array
  }

  interface Statement {
    bind(params?: any[]): boolean
    step(): boolean
    getAsObject(params?: any): Record<string, any>
    get(params?: any): any[]
    free(): boolean
    reset(): void
  }

  interface QueryExecResult {
    columns: string[]
    values: any[][]
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>
}
