# Skill: SQLite Storage

> CodeOmniVis 数据存储层开发指南。基于 sql.js（WASM）。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 实现或修改存储层（analyzer/storage/）
- 数据库 schema 变更
- 查询优化
- 调试数据问题

## 技术栈

- **sql.js** — SQLite 的 WASM 编译版本，零原生依赖
- 同步 API（WASM 在内存中运行）

## 数据库初始化

```typescript
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'

export async function createDatabase(dbPath: string): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  // 如果指定了文件路径，从磁盘加载已有数据
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  }

  // 建表
  db.run(CREATE_TABLES_SQL)

  return db
}
```

## Schema 定义

参考 `packages/analyzer/src/storage/schema.ts` 中的 `CREATE_TABLES_SQL`，包含：
- `nodes` 表（id, type, name, file_path, line, col, metadata, updated_at）
- `edges` 表（id, source, target, type, confidence, metadata, updated_at）
- `analysis_meta` 表（key, value）
- 索引：nodes(type), nodes(file_path), edges(source), edges(target), edges(type)

## 批量插入

```typescript
function insertGraph(db: SqlJsDatabase, nodes: OmniNode[], edges: OmniEdge[]) {
  const now = Date.now()
  db.run('BEGIN TRANSACTION')
  try {
    for (const node of nodes) {
      db.run(
        'INSERT OR REPLACE INTO nodes (id, type, name, file_path, line, col, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [node.id, node.type, node.name, node.filePath, node.line, node.column, JSON.stringify(node.metadata), now]
      )
    }
    for (const edge of edges) {
      db.run(
        'INSERT OR REPLACE INTO edges (id, source, target, type, confidence, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [edge.id, edge.source, edge.target, edge.type, edge.confidence, JSON.stringify(edge.metadata), now]
      )
    }
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
}
```

## 持久化

sql.js 在内存中运行，需要显式写入磁盘：

```typescript
function saveToDisk(db: SqlJsDatabase, dbPath: string) {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}
```

## 性能要点

- sql.js 是 WASM，初始化有一次性开销（~200ms），应复用实例
- 必须用事务批量插入/更新，不要逐条 INSERT
- 索引已建在 type、file_path、source、target 上
- 数据库句柄使用后必须 close()，避免内存泄漏
