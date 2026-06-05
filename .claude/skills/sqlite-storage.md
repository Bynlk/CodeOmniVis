# Skill: SQLite Storage

> OmniVis 数据存储层开发指南。基于 better-sqlite3。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 实现或修改存储层（analyzer/storage/）
- 数据库 schema 变更
- 查询优化
- 调试数据问题

## 技术栈

- **better-sqlite3** — 同步 SQLite 绑定，零依赖
- **WAL 模式** — 提高并发读性能

## 数据库初始化

```typescript
import Database from 'better-sqlite3'
import { SCHEMA_SQL } from './schema'

export function createDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath)

  // WAL 模式（提高并发性能）
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 建表
  db.exec(SCHEMA_SQL)

  return db
}
```

## Schema 定义

```typescript
// storage/schema.ts
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  line        INTEGER NOT NULL,
  col         INTEGER NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target      TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  confidence  TEXT NOT NULL DEFAULT 'certain',
  metadata    TEXT NOT NULL DEFAULT '{}',
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_type     ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_file     ON nodes(file_path);
CREATE INDEX IF NOT EXISTS idx_edges_source   ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target   ON edges(target);
CREATE INDEX IF NOT EXISTS idx_edges_type     ON edges(type);
`
```

## 批量插入（必须用事务）

```typescript
export function insertGraph(db: Database.Database, nodes: OmniNode[], edges: OmniEdge[]) {
  const insertNode = db.prepare(`
    INSERT OR REPLACE INTO nodes (id, type, name, file_path, line, col, metadata, updated_at)
    VALUES (@id, @type, @name, @filePath, @line, @column, @metadata, @updatedAt)
  `)

  const insertEdge = db.prepare(`
    INSERT OR REPLACE INTO edges (id, source, target, type, confidence, metadata, updated_at)
    VALUES (@id, @source, @target, @type, @confidence, @metadata, @updatedAt)
  `)

  const now = Date.now()

  // ✅ 正确：事务批量插入
  const insertAll = db.transaction(() => {
    for (const node of nodes) {
      insertNode.run({
        ...node,
        metadata: JSON.stringify(node.metadata),
        updatedAt: now,
      })
    }
    for (const edge of edges) {
      insertEdge.run({
        ...edge,
        metadata: JSON.stringify(edge.metadata),
        updatedAt: now,
      })
    }
  })

  insertAll()  // 执行事务
}
```

## 常用查询

```typescript
// 获取所有节点
function getAllNodes(db: Database.Database): OmniNode[] {
  return db.prepare('SELECT * FROM nodes').all().map(rowToNode)
}

// 按类型过滤
function getNodesByType(db: Database.Database, type: NodeType): OmniNode[] {
  return db.prepare('SELECT * FROM nodes WHERE type = ?').all(type).map(rowToNode)
}

// 获取节点的出边
function getOutEdges(db: Database.Database, nodeId: string): OmniEdge[] {
  return db.prepare('SELECT * FROM edges WHERE source = ?').all(nodeId).map(rowToEdge)
}

// 获取节点的入边
function getInEdges(db: Database.Database, nodeId: string): OmniEdge[] {
  return db.prepare('SELECT * FROM edges WHERE target = ?').all(nodeId).map(rowToEdge)
}

// 按文件路径删除（增量更新时用）
function deleteByFile(db: Database.Database, filePath: string) {
  db.prepare('DELETE FROM nodes WHERE file_path = ?').run(filePath)
  // 外键 CASCADE 会自动删除相关边
}

// 行转换
function rowToNode(row: any): OmniNode {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    filePath: row.file_path,
    line: row.line,
    column: row.col,
    metadata: JSON.parse(row.metadata),
  }
}

function rowToEdge(row: any): OmniEdge {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    type: row.type,
    confidence: row.confidence,
    metadata: JSON.parse(row.metadata),
  }
}
```

## 性能要点

- **必须用事务**批量插入/更新，不要逐条 INSERT
- **WAL 模式**允许并发读，适合 server 场景
- **索引**已建在 type、file_path、source、target 上
- **JSON 字段**用 `json_extract()` 查询：`WHERE json_extract(metadata, '$.route') = '/api/booking'`
