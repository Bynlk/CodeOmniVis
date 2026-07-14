/**
 * @codeomnivis/analyzer/storage — SQLite 存储层
 *
 * 提供图数据的持久化存储。
 * 使用 sql.js 实现零配置同步操作。
 */

export { OmniDatabase } from './db'
export type { AnalysisStore, DbError, DbStats, GraphSubtree } from './db'
export { openSqlDatabase } from './database'
export type { SqlDatabase } from './database'
export { NodeRepository } from './nodeRepository'
export { EdgeRepository } from './edgeRepository'
export { ErrorRepository } from './errorRepository'
export { GraphRepository } from './graphRepository'
export { StatsRepository } from './statsRepository'
export { persistDatabaseAtomically, replaceSnapshot } from './persistence'
export type { Repositories } from './persistence'
export { SQL, CREATE_TABLES_SQL, CURRENT_SCHEMA_VERSION, DROP_CACHE_TABLES_SQL } from './schema'
