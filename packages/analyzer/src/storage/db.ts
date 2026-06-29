/**
 * SQLite 数据库封装
 *
 * 使用 sql.js 提供纯 JavaScript 的 SQLite 实现。
 * 所有写操作使用事务提高性能。
 * 遵循"降级而非崩溃"原则，操作失败返回错误而非抛出异常。
 */

import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js'
import * as fs from 'fs'
import type { OmniNode, OmniEdge, OmniGraph, NodeType, EdgeType } from '@codeomnivis/shared'
import { CREATE_TABLES_SQL, SQL } from './schema'

// ============================================================
// 类型定义
// ============================================================

export interface DbError {
  file: string
  message: string
  severity: 'error' | 'warning' | 'info'
  originalError?: string
}

export interface DbStats {
  nodeCount: number
  edgeCount: number
  errorCount: number
  nodeTypeCounts: Record<string, number>
  edgeTypeCounts: Record<string, number>
}

const NODE_TYPES = new Set<string>([
  'page',
  'component',
  'api_route',
  'trpc_procedure',
  'tsrpc_service',
  'tsrpc_api',
  'tsrpc_msg',
  'express_route',
  'handler',
  'service',
  'db_model',
  'module',
  'kotlin_class',
  'kotlin_interface',
  'kotlin_object',
  'kotlin_function',
  'kotlin_route',
])

const EDGE_TYPES = new Set<string>([
  'renders',
  'navigates_to',
  'calls_api',
  'handles',
  'calls_service',
  'queries_db',
  'db_relation',
  'imports',
  'contains',
  'kotlin_inherits',
  'kotlin_implements',
  'kotlin_uses',
  'data_flows_to',
  'sends_msg',
  'listens_msg',
])

const EDGE_CONFIDENCES = new Set<string>(['certain', 'inferred'])
const DB_ERROR_SEVERITIES = new Set<string>(['error', 'warning', 'info'])

function isNodeType(value: string): value is NodeType {
  return NODE_TYPES.has(value)
}

function isEdgeType(value: string): value is EdgeType {
  return EDGE_TYPES.has(value)
}

function isEdgeConfidence(value: string): value is OmniEdge['confidence'] {
  return EDGE_CONFIDENCES.has(value)
}

function isDbErrorSeverity(value: string): value is DbError['severity'] {
  return DB_ERROR_SEVERITIES.has(value)
}

function sqlString(value: SqlValue | undefined): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function sqlOptionalString(value: SqlValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function sqlNumber(value: SqlValue | undefined): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function sqlNodeType(value: SqlValue | undefined): NodeType {
  const type = sqlString(value)
  return isNodeType(type) ? type : 'module'
}

function sqlEdgeType(value: SqlValue | undefined): EdgeType {
  const type = sqlString(value)
  return isEdgeType(type) ? type : 'imports'
}

function sqlEdgeConfidence(value: SqlValue | undefined): OmniEdge['confidence'] {
  const confidence = sqlString(value)
  return isEdgeConfidence(confidence) ? confidence : 'inferred'
}

function sqlDbErrorSeverity(value: SqlValue | undefined): DbError['severity'] {
  const severity = sqlString(value)
  return isDbErrorSeverity(severity) ? severity : 'warning'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ============================================================
// 数据库类
// ============================================================

export class OmniDatabase {
  private db: SqlJsDatabase | null = null
  private dbPath: string
  private initPromise: Promise<void>

  constructor(dbPath = ':memory:') {
    this.dbPath = dbPath
    this.initPromise = this.initialize()
  }

  /**
   * 初始化数据库：加载 WASM 并创建表
   * 如果 dbPath 是文件路径且文件存在，则从文件加载
   */
  private async initialize(): Promise<void> {
    try {
      const SQL_WASM = await initSqlJs()

      if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
        // 从已有文件加载
        const buffer = fs.readFileSync(this.dbPath)
        this.db = new SQL_WASM.Database(buffer)
      } else {
        // 创建新数据库
        this.db = new SQL_WASM.Database()
        // 执行建表语句
        this.db.run(CREATE_TABLES_SQL)
      }
    } catch (err) {
      console.error(`Failed to initialize database at ${this.dbPath}:`, err)
      throw err
    }
  }

  /**
   * 等待数据库初始化完成
   */
  async ready(): Promise<void> {
    await this.initPromise
  }

  /**
   * 关闭数据库连接（持久化到文件）
   */
  close(): void {
    if (this.db) {
      // 持久化到文件
      if (this.dbPath !== ':memory:') {
        try {
          const data = this.db.export()
          const buffer = Buffer.from(data)
          fs.writeFileSync(this.dbPath, buffer)
        } catch (err) {
          console.error(`Failed to persist database to ${this.dbPath}:`, err)
        }
      }
      this.db.close()
      this.db = null
    }
  }

  /**
   * 检查数据库是否已初始化
   */
  private ensureReady(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call ready() first.')
    }
    return this.db
  }

  // ============================================================
  // 节点操作
  // ============================================================

  /**
   * 插入或更新节点
   * @returns 成功返回 true，失败返回 false
   */
  upsertNode(node: OmniNode): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.insertNode, [
        node.id,
        node.type,
        node.name,
        node.filePath,
        node.line,
        node.column,
        JSON.stringify(node.metadata) ?? null,
      ])
      return true
    } catch (err) {
      console.error(`Failed to upsert node ${node.id}:`, err)
      return false
    }
  }

  /**
   * 批量插入或更新节点（使用事务）
   * @returns 成功插入的数量
   */
  upsertNodes(nodes: OmniNode[]): number {
    if (nodes.length === 0) return 0

    try {
      this.ensureReady()
      let count = 0

      this.ensureReady().run('BEGIN TRANSACTION')
      for (const node of nodes) {
        try {
          this.ensureReady().run(SQL.insertNode, [
            node.id,
            node.type,
            node.name,
            node.filePath,
            node.line,
            node.column,
            JSON.stringify(node.metadata) ?? null,
          ])
          count++
        } catch (err) {
          console.error(`Failed to upsert node ${node.id}:`, err)
        }
      }
      this.ensureReady().run('COMMIT')

      return count
    } catch (err) {
      console.error('Failed to upsert nodes:', err)
      try {
        this.ensureReady().run('ROLLBACK')
      } catch (rollbackErr) {
        console.error('ROLLBACK failed after upsertNodes error:', rollbackErr)
      }
      return 0
    }
  }

  /**
   * 获取单个节点
   */
  getNode(id: string): OmniNode | null {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectNode)
      stmt.bind([id])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return this.rowToNode(row)
      }
      stmt.free()
      return null
    } catch (err) {
      console.error(`Failed to get node ${id}:`, err)
      return null
    }
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): OmniNode[] {
    try {
      this.ensureReady()
      const results = this.ensureReady().exec(SQL.selectAllNodes)
      if (results.length === 0) return []
      return results[0].values.map(row => this.arrayToNode(row))
    } catch (err) {
      console.error('Failed to get all nodes:', err)
      return []
    }
  }

  /**
   * 按类型获取节点
   */
  getNodesByType(type: NodeType): OmniNode[] {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectNodesByType)
      stmt.bind([type])
      const nodes: OmniNode[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        nodes.push(this.rowToNode(row))
      }
      stmt.free()
      return nodes
    } catch (err) {
      console.error(`Failed to get nodes by type ${type}:`, err)
      return []
    }
  }

  /**
   * 按文件路径获取节点
   */
  getNodesByFile(filePath: string): OmniNode[] {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectNodesByFile)
      stmt.bind([filePath])
      const nodes: OmniNode[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        nodes.push(this.rowToNode(row))
      }
      stmt.free()
      return nodes
    } catch (err) {
      console.error(`Failed to get nodes by file ${filePath}:`, err)
      return []
    }
  }

  /**
   * 删除节点
   */
  deleteNode(id: string): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.deleteNode, [id])
      return true
    } catch (err) {
      console.error(`Failed to delete node ${id}:`, err)
      return false
    }
  }

  /**
   * 删除所有节点
   */
  deleteAllNodes(): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.deleteAllNodes)
      return true
    } catch (err) {
      console.error('Failed to delete all nodes:', err)
      return false
    }
  }

  // ============================================================
  // 边操作
  // ============================================================

  /**
   * 插入或更新边（暂时禁用 FK 检查）
   * @returns 成功返回 true，失败返回 false
   */
  upsertEdge(edge: OmniEdge): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run('PRAGMA foreign_keys = OFF')
      this.ensureReady().run(SQL.insertEdge, [
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        edge.confidence,
        JSON.stringify(edge.metadata) ?? null,
      ])
      this.ensureReady().run('PRAGMA foreign_keys = ON')
      return true
    } catch (err) {
      console.error(`Failed to upsert edge ${edge.id}:`, err)
      try { this.ensureReady().run('PRAGMA foreign_keys = ON') } catch { /* ignore */ }
      return false
    }
  }

  /**
   * 批量插入或更新边（使用事务，暂时禁用 FK 检查避免跨层边写入失败）
   * @returns 成功插入的数量
   */
  upsertEdges(edges: OmniEdge[]): number {
    if (edges.length === 0) return 0

    try {
      this.ensureReady()
      let count = 0

      // 暂时禁用 FK 检查，允许引用尚未存在的节点的边写入
      this.ensureReady().run('PRAGMA foreign_keys = OFF')
      this.ensureReady().run('BEGIN TRANSACTION')
      for (const edge of edges) {
        try {
          this.ensureReady().run(SQL.insertEdge, [
            edge.id,
            edge.source,
            edge.target,
            edge.type,
            edge.confidence,
            JSON.stringify(edge.metadata) ?? null,
          ])
          count++
        } catch (err) {
          console.error(`Failed to upsert edge ${edge.id}:`, err)
        }
      }
      this.ensureReady().run('COMMIT')
      this.ensureReady().run('PRAGMA foreign_keys = ON')

      return count
    } catch (err) {
      console.error('Failed to upsert edges:', err)
      try {
        this.ensureReady().run('ROLLBACK')
        this.ensureReady().run('PRAGMA foreign_keys = ON')
      } catch (rollbackErr) {
        console.error('ROLLBACK failed after upsertEdges error:', rollbackErr)
      }
      return 0
    }
  }

  /**
   * 获取单个边
   */
  getEdge(id: string): OmniEdge | null {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectEdge)
      stmt.bind([id])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return this.rowToEdge(row)
      }
      stmt.free()
      return null
    } catch (err) {
      console.error(`Failed to get edge ${id}:`, err)
      return null
    }
  }

  /**
   * 获取所有边
   */
  getAllEdges(): OmniEdge[] {
    try {
      this.ensureReady()
      const results = this.ensureReady().exec(SQL.selectAllEdges)
      if (results.length === 0) return []
      return results[0].values.map(row => this.arrayToEdge(row))
    } catch (err) {
      console.error('Failed to get all edges:', err)
      return []
    }
  }

  /**
   * 按类型获取边
   */
  getEdgesByType(type: EdgeType): OmniEdge[] {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectEdgesByType)
      stmt.bind([type])
      const edges: OmniEdge[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        edges.push(this.rowToEdge(row))
      }
      stmt.free()
      return edges
    } catch (err) {
      console.error(`Failed to get edges by type ${type}:`, err)
      return []
    }
  }

  /**
   * 获取节点的出边
   */
  getOutEdges(nodeId: string): OmniEdge[] {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectEdgesBySource)
      stmt.bind([nodeId])
      const edges: OmniEdge[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        edges.push(this.rowToEdge(row))
      }
      stmt.free()
      return edges
    } catch (err) {
      console.error(`Failed to get out edges for ${nodeId}:`, err)
      return []
    }
  }

  /**
   * 获取节点的入边
   */
  getInEdges(nodeId: string): OmniEdge[] {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.selectEdgesByTarget)
      stmt.bind([nodeId])
      const edges: OmniEdge[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        edges.push(this.rowToEdge(row))
      }
      stmt.free()
      return edges
    } catch (err) {
      console.error(`Failed to get in edges for ${nodeId}:`, err)
      return []
    }
  }

  /**
   * 删除边
   */
  deleteEdge(id: string): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.deleteEdge, [id])
      return true
    } catch (err) {
      console.error(`Failed to delete edge ${id}:`, err)
      return false
    }
  }

  /**
   * 删除所有边
   */
  deleteAllEdges(): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.deleteAllEdges)
      return true
    } catch (err) {
      console.error('Failed to delete all edges:', err)
      return false
    }
  }

  // ============================================================
  // 解析错误操作
  // ============================================================

  /**
   * 插入解析错误
   */
  insertError(error: DbError): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.insertError, [
        error.file,
        error.message,
        error.severity,
        error.originalError || null,
      ])
      return true
    } catch (err) {
      console.error('Failed to insert error:', err)
      return false
    }
  }

  /**
   * 批量插入解析错误
   */
  insertErrors(errors: DbError[]): number {
    if (errors.length === 0) return 0

    try {
      this.ensureReady()
      let count = 0

      this.ensureReady().run('BEGIN TRANSACTION')
      for (const error of errors) {
        try {
          this.ensureReady().run(SQL.insertError, [
            error.file,
            error.message,
            error.severity,
            error.originalError || null,
          ])
          count++
        } catch (err) {
          console.error('Failed to insert error:', err)
        }
      }
      this.ensureReady().run('COMMIT')

      return count
    } catch (err) {
      console.error('Failed to insert errors:', err)
      try {
        this.ensureReady().run('ROLLBACK')
      } catch (rollbackErr) {
        console.error('ROLLBACK failed after insertErrors error:', rollbackErr)
      }
      return 0
    }
  }

  /**
   * 获取所有解析错误
   */
  getAllErrors(): DbError[] {
    try {
      this.ensureReady()
      const results = this.ensureReady().exec(SQL.selectAllErrors)
      if (results.length === 0) return []
      // 列顺序: id, file, message, severity, original_error, created_at
      return results[0].values.map(row => ({
          file: sqlString(row[1]),
          message: sqlString(row[2]),
          severity: sqlDbErrorSeverity(row[3]),
          originalError: sqlOptionalString(row[4]),
      }))
    } catch (err) {
      console.error('Failed to get all errors:', err)
      return []
    }
  }

  /**
   * 删除所有解析错误
   */
  deleteAllErrors(): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.deleteAllErrors)
      return true
    } catch (err) {
      console.error('Failed to delete all errors:', err)
      return false
    }
  }

  // ============================================================
  // 项目元数据操作
  // ============================================================

  /**
   * 设置项目元数据
   */
  setMeta(key: string, value: string): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run(SQL.setMeta, [key, value])
      return true
    } catch (err) {
      console.error(`Failed to set meta ${key}:`, err)
      return false
    }
  }

  /**
   * 获取项目元数据
   */
  getMeta(key: string): string | null {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(SQL.getMeta)
      stmt.bind([key])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
          return sqlString(row.value)
      }
      stmt.free()
      return null
    } catch (err) {
      console.error(`Failed to get meta ${key}:`, err)
      return null
    }
  }

  // ============================================================
  // 图操作
  // ============================================================

  /**
   * 将完整的图写入数据库
   */
  saveGraph(graph: OmniGraph): { nodesSaved: number; edgesSaved: number } {
    const nodesSaved = this.upsertNodes(graph.nodes)
    const edgesSaved = this.upsertEdges(graph.edges)
    return { nodesSaved, edgesSaved }
  }

  /**
   * 从数据库加载完整的图
   */
  loadGraph(): OmniGraph {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    }
  }

  /**
   * 清空整个图
   */
  clearGraph(): boolean {
    try {
      this.ensureReady()
      this.ensureReady().run('DELETE FROM edges')
      this.ensureReady().run('DELETE FROM nodes')
      this.ensureReady().run('DELETE FROM parse_errors')
      return true
    } catch (err) {
      console.error('Failed to clear graph:', err)
      return false
    }
  }

  // ============================================================
  // 统计查询
  // ============================================================

  /**
   * 获取数据库统计信息
   */
  getStats(): DbStats {
    try {
      this.ensureReady()

      const nodeCountResult = this.ensureReady().exec(SQL.countNodes)
      const nodeCount = nodeCountResult.length > 0 ? sqlNumber(nodeCountResult[0].values[0][0]) : 0

      const edgeCountResult = this.ensureReady().exec(SQL.countEdges)
      const edgeCount = edgeCountResult.length > 0 ? sqlNumber(edgeCountResult[0].values[0][0]) : 0

      const errorCountResult = this.ensureReady().exec(SQL.countErrors)
      const errorCount = errorCountResult.length > 0 ? sqlNumber(errorCountResult[0].values[0][0]) : 0

      const nodeTypeCounts: Record<string, number> = {}
      const nodeTypeResult = this.ensureReady().exec(SQL.nodeTypeCounts)
      if (nodeTypeResult.length > 0) {
        for (const row of nodeTypeResult[0].values) {
            nodeTypeCounts[sqlString(row[0])] = sqlNumber(row[1])
        }
      }

      const edgeTypeCounts: Record<string, number> = {}
      const edgeTypeResult = this.ensureReady().exec(SQL.edgeTypeCounts)
      if (edgeTypeResult.length > 0) {
        for (const row of edgeTypeResult[0].values) {
            edgeTypeCounts[sqlString(row[0])] = sqlNumber(row[1])
        }
      }

      return { nodeCount, edgeCount, errorCount, nodeTypeCounts, edgeTypeCounts }
    } catch (err) {
      console.error('Failed to get stats:', err)
      return { nodeCount: 0, edgeCount: 0, errorCount: 0, nodeTypeCounts: {}, edgeTypeCounts: {} }
    }
  }

  // ============================================================
  // MCP 工具查询方法
  // ============================================================

  /**
   * 按多个类型获取节点
   */
  getNodesByTypes(types: NodeType[]): OmniNode[] {
    try {
      this.ensureReady()
      if (types.length === 0) return []
      const placeholders = types.map(() => '?').join(',')
      const stmt = this.ensureReady().prepare(`SELECT * FROM nodes WHERE type IN (${placeholders})`)
      stmt.bind(types)
      const nodes: OmniNode[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        nodes.push(this.rowToNode(row))
      }
      stmt.free()
      return nodes
    } catch (err) {
      console.error(`Failed to get nodes by types:`, err)
      return []
    }
  }

  /**
   * 获取下游节点（通过出边连接的节点）
   */
  getDownstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
    try {
      this.ensureReady()
      const edgeFilter = edgeTypes && edgeTypes.length > 0
        ? `AND e.type IN (${edgeTypes.map(() => '?').join(',')})`
        : ''
      const sql = `
        SELECT n.* FROM nodes n
        JOIN edges e ON e.target = n.id
        WHERE e.source = ? ${edgeFilter}
      `
      const params = edgeTypes && edgeTypes.length > 0
        ? [nodeId, ...edgeTypes]
        : [nodeId]
      const stmt = this.ensureReady().prepare(sql)
      stmt.bind(params)
      const nodes: OmniNode[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        nodes.push(this.rowToNode(row))
      }
      stmt.free()
      return nodes
    } catch (err) {
      console.error(`Failed to get downstream nodes for ${nodeId}:`, err)
      return []
    }
  }

  /**
   * 获取上游节点（通过入边连接的节点）
   */
  getUpstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
    try {
      this.ensureReady()
      const edgeFilter = edgeTypes && edgeTypes.length > 0
        ? `AND e.type IN (${edgeTypes.map(() => '?').join(',')})`
        : ''
      const sql = `
        SELECT n.* FROM nodes n
        JOIN edges e ON e.source = n.id
        WHERE e.target = ? ${edgeFilter}
      `
      const params = edgeTypes && edgeTypes.length > 0
        ? [nodeId, ...edgeTypes]
        : [nodeId]
      const stmt = this.ensureReady().prepare(sql)
      stmt.bind(params)
      const nodes: OmniNode[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        nodes.push(this.rowToNode(row))
      }
      stmt.free()
      return nodes
    } catch (err) {
      console.error(`Failed to get upstream nodes for ${nodeId}:`, err)
      return []
    }
  }

  /**
   * 按路由查找节点
   */
  findNodeByRoute(route: string): OmniNode | null {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(
        `SELECT * FROM nodes WHERE json_extract(metadata, '$.route') = ? LIMIT 1`
      )
      stmt.bind([route])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return this.rowToNode(row)
      }
      stmt.free()
      return null
    } catch (err) {
      console.error(`Failed to find node by route ${route}:`, err)
      return null
    }
  }

  /**
   * 按文件路径查找节点
   */
  findNodeByFilePath(filePath: string): OmniNode | null {
    try {
      this.ensureReady()
      const stmt = this.ensureReady().prepare(`SELECT * FROM nodes WHERE file_path = ? LIMIT 1`)
      stmt.bind([filePath])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return this.rowToNode(row)
      }
      stmt.free()
      return null
    } catch (err) {
      console.error(`Failed to find node by file path ${filePath}:`, err)
      return null
    }
  }

  /**
   * 按任意标识查找节点（路由 → 名称）
   */
  findNodeByAny(query: string): OmniNode | null {
    return this.findNodeByRoute(query)
      ?? this.findNodeByFilePath(query)
      ?? (() => {
        try {
          this.ensureReady()
          const stmt = this.ensureReady().prepare(`SELECT * FROM nodes WHERE name = ? LIMIT 1`)
          stmt.bind([query])
          if (stmt.step()) {
            const row = stmt.getAsObject()
            stmt.free()
            return this.rowToNode(row)
          }
          stmt.free()
          return null
        } catch (err) {
          console.error(`Failed to find node by name ${query}:`, err)
          return null
        }
      })()
  }

  /**
   * 获取受影响的页面（BFS 向上追溯到 page 节点）
   */
  getAffectedPages(nodeId: string, maxDepth = 10): OmniNode[] {
    const visited = new Set<string>()
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }]
    const pages: OmniNode[] = []

    // 只沿有意义的调用链向上追溯，不走 renders/imports/contains
    const callEdgeTypes: EdgeType[] = ['calls_api', 'handles', 'calls_service', 'queries_db']

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break

      const { id, depth } = current
      if (visited.has(id) || depth > maxDepth) continue
      visited.add(id)

      const upstreams = this.getUpstreamNodes(id, callEdgeTypes)
      for (const up of upstreams) {
        if (up.type === 'page') {
          if (!pages.find(p => p.id === up.id)) pages.push(up)
        } else {
          queue.push({ id: up.id, depth: depth + 1 })
        }
      }
    }
    return pages
  }

  /**
   * 获取子树（递归获取下游节点）
   */
  getSubtree(rootId: string, edgeType: EdgeType, maxDepth: number): Record<string, unknown> {
    const root = this.getNode(rootId)
    if (!root) return {}

    if (maxDepth === 0) {
      return { id: root.id, name: root.name, type: root.type, children: [] }
    }

    const children = this.getDownstreamNodes(rootId, [edgeType])
    return {
      id: root.id,
      name: root.name,
      type: root.type,
      children: children.map(c => this.getSubtree(c.id, edgeType, maxDepth - 1)),
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 安全解析 JSON 字符串，失败返回空对象
   */
  private safeJsonParse(jsonStr: SqlValue | undefined, context: string): Record<string, unknown> {
    if (typeof jsonStr !== 'string') {
      return {}
    }

    try {
      const parsed = JSON.parse(jsonStr)
      return isRecord(parsed) ? parsed : {}
    } catch (err) {
      console.warn(`Failed to parse JSON for ${context}, using empty object:`, err)
      return {}
    }
  }

  /**
   * 将数据库行对象转换为 OmniNode
   */
  private rowToNode(row: Record<string, SqlValue>): OmniNode {
    return {
      id: sqlString(row.id),
      type: sqlNodeType(row.type),
      name: sqlString(row.name),
      filePath: sqlString(row.file_path),
      line: sqlNumber(row.line),
      column: sqlNumber(row.column),
      metadata: this.safeJsonParse(row.metadata, `node ${row.id}`),
    }
  }

  /**
   * 将数组形式的行转换为 OmniNode
   */
  private arrayToNode(row: SqlValue[]): OmniNode {
    return {
      id: sqlString(row[0]),
      type: sqlNodeType(row[1]),
      name: sqlString(row[2]),
      filePath: sqlString(row[3]),
      line: sqlNumber(row[4]),
      column: sqlNumber(row[5]),
      metadata: this.safeJsonParse(row[6], `node ${row[0]}`),
    }
  }

  /**
   * 将数据库行对象转换为 OmniEdge
   */
  private rowToEdge(row: Record<string, SqlValue>): OmniEdge {
    return {
      id: sqlString(row.id),
      source: sqlString(row.source),
      target: sqlString(row.target),
      type: sqlEdgeType(row.type),
      confidence: sqlEdgeConfidence(row.confidence),
      metadata: this.safeJsonParse(row.metadata, `edge ${row.id}`),
    }
  }

  /**
   * 将数组形式的行转换为 OmniEdge
   */
  private arrayToEdge(row: SqlValue[]): OmniEdge {
    return {
      id: sqlString(row[0]),
      source: sqlString(row[1]),
      target: sqlString(row[2]),
      type: sqlEdgeType(row[3]),
      confidence: sqlEdgeConfidence(row[4]),
      metadata: this.safeJsonParse(row[5], `edge ${row[0]}`),
    }
  }
}
