/**
 * SQLite 数据库 Schema 定义
 *
 * 使用 WAL 模式提高并发性能。
 * 节点和边的 metadata 以 JSON 字符串存储。
 */

// ============================================================
// 建表语句
// ============================================================

export const CREATE_TABLES_SQL = `
-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 启用 WAL 模式
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- Schema version for CodeOmniVis-owned cache tables.
CREATE TABLE IF NOT EXISTS schema_meta (
  version INTEGER NOT NULL
);

-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line INTEGER NOT NULL DEFAULT 0,
  column INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 边表
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'inferred',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target) REFERENCES nodes(id) ON DELETE CASCADE
);

-- 解析错误表
CREATE TABLE IF NOT EXISTS parse_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  original_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 项目元数据表
CREATE TABLE IF NOT EXISTS project_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Only the latest committed snapshot is retained; replacement happens in one transaction.
CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id TEXT PRIMARY KEY,
  snapshot_digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_file_path ON nodes(file_path);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
CREATE INDEX IF NOT EXISTS idx_parse_errors_file ON parse_errors(file);
CREATE INDEX IF NOT EXISTS idx_parse_errors_severity ON parse_errors(severity);
`

export const CURRENT_SCHEMA_VERSION = 1

export const DROP_CACHE_TABLES_SQL = `
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS parse_errors;
DROP TABLE IF EXISTS project_meta;
DROP TABLE IF EXISTS snapshots;
DROP TABLE IF EXISTS schema_meta;
`

// ============================================================
// 预编译 SQL 语句
// ============================================================

export const SQL = {
  // 节点操作
  insertNode: `
    INSERT OR REPLACE INTO nodes (id, type, name, file_path, line, column, metadata, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `,
  selectNode: `SELECT * FROM nodes WHERE id = ?`,
  selectAllNodes: `SELECT * FROM nodes`,
  selectNodesByType: `SELECT * FROM nodes WHERE type = ?`,
  selectNodesByFile: `SELECT * FROM nodes WHERE file_path = ?`,
  deleteNode: `DELETE FROM nodes WHERE id = ?`,
  deleteAllNodes: `DELETE FROM nodes`,

  // 边操作（使用 INSERT OR IGNORE 避免 FK constraint 失败时中断流程）
  insertEdge: `
    INSERT OR IGNORE INTO edges (id, source, target, type, confidence, metadata, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `,
  selectEdge: `SELECT * FROM edges WHERE id = ?`,
  selectAllEdges: `SELECT * FROM edges`,
  selectEdgesByType: `SELECT * FROM edges WHERE type = ?`,
  selectEdgesBySource: `SELECT * FROM edges WHERE source = ?`,
  selectEdgesByTarget: `SELECT * FROM edges WHERE target = ?`,
  deleteEdge: `DELETE FROM edges WHERE id = ?`,
  deleteAllEdges: `DELETE FROM edges`,

  // 解析错误操作
  insertError: `
    INSERT INTO parse_errors (file, message, severity, original_error)
    VALUES (?, ?, ?, ?)
  `,
  selectAllErrors: `SELECT * FROM parse_errors`,
  selectErrorsByFile: `SELECT * FROM parse_errors WHERE file = ?`,
  selectErrorsBySeverity: `SELECT * FROM parse_errors WHERE severity = ?`,
  deleteAllErrors: `DELETE FROM parse_errors`,

  // 项目元数据操作
  setMeta: `
    INSERT OR REPLACE INTO project_meta (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `,
  getMeta: `SELECT value FROM project_meta WHERE key = ?`,
  getAllMeta: `SELECT * FROM project_meta`,
  deleteMeta: `DELETE FROM project_meta WHERE key = ?`,

  // Snapshot operations
  insertSnapshot: `
    INSERT INTO snapshots (snapshot_id, snapshot_digest, payload)
    VALUES (?, ?, ?)
  `,
  selectLatestSnapshot: `
    SELECT payload FROM snapshots ORDER BY created_at DESC, rowid DESC LIMIT 1
  `,
  deleteSnapshots: `DELETE FROM snapshots`,

  // 统计查询
  countNodes: `SELECT COUNT(*) as count FROM nodes`,
  countEdges: `SELECT COUNT(*) as count FROM edges`,
  countErrors: `SELECT COUNT(*) as count FROM parse_errors`,
  nodeTypeCounts: `SELECT type, COUNT(*) as count FROM nodes GROUP BY type`,
  edgeTypeCounts: `SELECT type, COUNT(*) as count FROM edges GROUP BY type`,
}
