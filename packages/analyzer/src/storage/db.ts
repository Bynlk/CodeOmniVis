/**
 * SQLite 数据库封装
 *
 * 使用 sql.js 提供纯 JavaScript 的 SQLite 实现。
 * 所有写操作使用事务提高性能。
 * 遵循"降级而非崩溃"原则，操作失败返回错误而非抛出异常。
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import type { OmniNode, OmniEdge, OmniGraph, NodeType, EdgeType } from '@omnivis/shared'
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

// ============================================================
// 数据库类
// ============================================================

export class OmniDatabase {
  private db: SqlJsDatabase | null = null
  private dbPath: string
  private initPromise: Promise<void>

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath
    this.initPromise = this.initialize()
  }

  /**
   * 初始化数据库：加载 WASM 并创建表
   */
  private async initialize(): Promise<void> {
    try {
      const SQL = await initSqlJs()
      this.db = new SQL.Database()

      // 执行建表语句
      this.db.run(CREATE_TABLES_SQL)
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
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * 检查数据库是否已初始化
   */
  private ensureReady(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call ready() first.')
    }
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
      this.db!.run(SQL.insertNode, [
        node.id,
        node.type,
        node.name,
        node.filePath,
        node.line,
        node.column,
        JSON.stringify(node.metadata),
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

      this.db!.run('BEGIN TRANSACTION')
      for (const node of nodes) {
        try {
          this.db!.run(SQL.insertNode, [
            node.id,
            node.type,
            node.name,
            node.filePath,
            node.line,
            node.column,
            JSON.stringify(node.metadata),
          ])
          count++
        } catch (err) {
          console.error(`Failed to upsert node ${node.id}:`, err)
        }
      }
      this.db!.run('COMMIT')

      return count
    } catch (err) {
      console.error('Failed to upsert nodes:', err)
      try {
        this.db!.run('ROLLBACK')
      } catch {}
      return 0
    }
  }

  /**
   * 获取单个节点
   */
  getNode(id: string): OmniNode | null {
    try {
      this.ensureReady()
      const stmt = this.db!.prepare(SQL.selectNode)
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
      const results = this.db!.exec(SQL.selectAllNodes)
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
      const stmt = this.db!.prepare(SQL.selectNodesByType)
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
      const stmt = this.db!.prepare(SQL.selectNodesByFile)
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
      this.db!.run(SQL.deleteNode, [id])
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
      this.db!.run(SQL.deleteAllNodes)
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
   * 插入或更新边
   * @returns 成功返回 true，失败返回 false
   */
  upsertEdge(edge: OmniEdge): boolean {
    try {
      this.ensureReady()
      this.db!.run(SQL.insertEdge, [
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        edge.confidence,
        JSON.stringify(edge.metadata),
      ])
      return true
    } catch (err) {
      console.error(`Failed to upsert edge ${edge.id}:`, err)
      return false
    }
  }

  /**
   * 批量插入或更新边（使用事务）
   * @returns 成功插入的数量
   */
  upsertEdges(edges: OmniEdge[]): number {
    if (edges.length === 0) return 0

    try {
      this.ensureReady()
      let count = 0

      this.db!.run('BEGIN TRANSACTION')
      for (const edge of edges) {
        try {
          this.db!.run(SQL.insertEdge, [
            edge.id,
            edge.source,
            edge.target,
            edge.type,
            edge.confidence,
            JSON.stringify(edge.metadata),
          ])
          count++
        } catch (err) {
          console.error(`Failed to upsert edge ${edge.id}:`, err)
        }
      }
      this.db!.run('COMMIT')

      return count
    } catch (err) {
      console.error('Failed to upsert edges:', err)
      try {
        this.db!.run('ROLLBACK')
      } catch {}
      return 0
    }
  }

  /**
   * 获取单个边
   */
  getEdge(id: string): OmniEdge | null {
    try {
      this.ensureReady()
      const stmt = this.db!.prepare(SQL.selectEdge)
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
      const results = this.db!.exec(SQL.selectAllEdges)
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
      const stmt = this.db!.prepare(SQL.selectEdgesByType)
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
      const stmt = this.db!.prepare(SQL.selectEdgesBySource)
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
      const stmt = this.db!.prepare(SQL.selectEdgesByTarget)
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
      this.db!.run(SQL.deleteEdge, [id])
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
      this.db!.run(SQL.deleteAllEdges)
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
      this.db!.run(SQL.insertError, [
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

      this.db!.run('BEGIN TRANSACTION')
      for (const error of errors) {
        try {
          this.db!.run(SQL.insertError, [
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
      this.db!.run('COMMIT')

      return count
    } catch (err) {
      console.error('Failed to insert errors:', err)
      try {
        this.db!.run('ROLLBACK')
      } catch {}
      return 0
    }
  }

  /**
   * 获取所有解析错误
   */
  getAllErrors(): DbError[] {
    try {
      this.ensureReady()
      const results = this.db!.exec(SQL.selectAllErrors)
      if (results.length === 0) return []
      // 列顺序: id, file, message, severity, original_error, created_at
      return results[0].values.map(row => ({
        file: row[1] as string,
        message: row[2] as string,
        severity: row[3] as 'error' | 'warning' | 'info',
        originalError: row[4] as string | undefined,
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
      this.db!.run(SQL.deleteAllErrors)
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
      this.db!.run(SQL.setMeta, [key, value])
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
      const stmt = this.db!.prepare(SQL.getMeta)
      stmt.bind([key])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return row.value as string
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
      this.db!.run('DELETE FROM edges')
      this.db!.run('DELETE FROM nodes')
      this.db!.run('DELETE FROM parse_errors')
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

      const nodeCountResult = this.db!.exec(SQL.countNodes)
      const nodeCount = nodeCountResult.length > 0 ? (nodeCountResult[0].values[0][0] as number) : 0

      const edgeCountResult = this.db!.exec(SQL.countEdges)
      const edgeCount = edgeCountResult.length > 0 ? (edgeCountResult[0].values[0][0] as number) : 0

      const errorCountResult = this.db!.exec(SQL.countErrors)
      const errorCount = errorCountResult.length > 0 ? (errorCountResult[0].values[0][0] as number) : 0

      const nodeTypeCounts: Record<string, number> = {}
      const nodeTypeResult = this.db!.exec(SQL.nodeTypeCounts)
      if (nodeTypeResult.length > 0) {
        for (const row of nodeTypeResult[0].values) {
          nodeTypeCounts[row[0] as string] = row[1] as number
        }
      }

      const edgeTypeCounts: Record<string, number> = {}
      const edgeTypeResult = this.db!.exec(SQL.edgeTypeCounts)
      if (edgeTypeResult.length > 0) {
        for (const row of edgeTypeResult[0].values) {
          edgeTypeCounts[row[0] as string] = row[1] as number
        }
      }

      return { nodeCount, edgeCount, errorCount, nodeTypeCounts, edgeTypeCounts }
    } catch (err) {
      console.error('Failed to get stats:', err)
      return { nodeCount: 0, edgeCount: 0, errorCount: 0, nodeTypeCounts: {}, edgeTypeCounts: {} }
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 将数据库行对象转换为 OmniNode
   */
  private rowToNode(row: Record<string, any>): OmniNode {
    return {
      id: row.id as string,
      type: row.type as NodeType,
      name: row.name as string,
      filePath: row.file_path as string,
      line: row.line as number,
      column: row.column as number,
      metadata: JSON.parse(row.metadata as string),
    }
  }

  /**
   * 将数组形式的行转换为 OmniNode
   */
  private arrayToNode(row: any[]): OmniNode {
    return {
      id: row[0] as string,
      type: row[1] as NodeType,
      name: row[2] as string,
      filePath: row[3] as string,
      line: row[4] as number,
      column: row[5] as number,
      metadata: JSON.parse(row[6] as string),
    }
  }

  /**
   * 将数据库行对象转换为 OmniEdge
   */
  private rowToEdge(row: Record<string, any>): OmniEdge {
    return {
      id: row.id as string,
      source: row.source as string,
      target: row.target as string,
      type: row.type as EdgeType,
      confidence: row.confidence as 'certain' | 'inferred',
      metadata: JSON.parse(row.metadata as string),
    }
  }

  /**
   * 将数组形式的行转换为 OmniEdge
   */
  private arrayToEdge(row: any[]): OmniEdge {
    return {
      id: row[0] as string,
      source: row[1] as string,
      target: row[2] as string,
      type: row[3] as EdgeType,
      confidence: row[4] as 'certain' | 'inferred',
      metadata: JSON.parse(row[5] as string),
    }
  }
}
