/**
 * 图构建器
 *
 * 合并多个 Parser 的输出，去重，写入数据库。
 * 遵循"边的 source/target 必须存在"原则。
 */

import type {
  OmniGraph,
  OmniNode,
  OmniEdge,
  ParseResult,
  Parser,
  ParseContext,
} from '@omnivis/shared'
import { OmniDatabase } from '../storage/db'

// ============================================================
// 类型定义
// ============================================================

export interface BuildResult {
  graph: OmniGraph
  stats: {
    totalNodes: number
    totalEdges: number
    totalErrors: number
    nodesByType: Record<string, number>
    edgesByType: Record<string, number>
    skippedEdges: number
  }
}

// ============================================================
// 图构建器
// ============================================================

export class GraphBuilder {
  private db: OmniDatabase
  private parsers: Parser[] = []

  constructor(db: OmniDatabase) {
    this.db = db
  }

  /**
   * 注册解析器
   */
  registerParser(parser: Parser): void {
    this.parsers.push(parser)
  }

  /**
   * 批量注册解析器
   */
  registerParsers(parsers: Parser[]): void {
    this.parsers.push(...parsers)
  }

  /**
   * 对指定文件执行解析
   */
  async parseFiles(files: string[], context: ParseContext): Promise<BuildResult> {
    const allNodes: OmniNode[] = []
    const allEdges: OmniEdge[] = []
    const allErrors: ParseResult['errors'] = []

    // 对每个文件，找到能处理它的解析器
    for (const file of files) {
      for (const parser of this.parsers) {
        if (parser.canHandle(file, context.projectMeta)) {
          try {
            const result = await parser.parse(file, context)
            allNodes.push(...result.nodes)
            allEdges.push(...result.edges)
            allErrors.push(...result.errors)
          } catch (err) {
            allErrors.push({
              file,
              message: `Parser ${parser.name} failed: ${err instanceof Error ? err.message : String(err)}`,
              severity: 'error',
            })
          }
        }
      }
    }

    // 去重节点
    const uniqueNodes = this.deduplicateNodes(allNodes)

    // 验证边的 source/target 存在，并去重
    const { validEdges, skippedEdges } = this.validateAndDeduplicateEdges(allEdges, uniqueNodes)

    // 写入数据库
    const nodesSaved = this.db.upsertNodes(uniqueNodes)
    const edgesSaved = this.db.upsertEdges(validEdges)
    // 转换 ParseError 为 DbError 格式
    const dbErrors = allErrors.map(e => ({
      file: e.file,
      message: e.message,
      severity: e.severity,
      originalError: e.originalError ? String(e.originalError) : undefined,
    }))
    this.db.insertErrors(dbErrors)

    // 构建结果图
    const graph: OmniGraph = {
      nodes: uniqueNodes,
      edges: validEdges,
    }

    // 统计信息
    const nodesByType: Record<string, number> = {}
    for (const node of uniqueNodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1
    }

    const edgesByType: Record<string, number> = {}
    for (const edge of validEdges) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1
    }

    return {
      graph,
      stats: {
        totalNodes: uniqueNodes.length,
        totalEdges: validEdges.length,
        totalErrors: allErrors.length,
        nodesByType,
        edgesByType,
        skippedEdges,
      },
    }
  }

  /**
   * 节点去重
   * 同一 ID 的节点只保留最后一个
   */
  private deduplicateNodes(nodes: OmniNode[]): OmniNode[] {
    const seen = new Map<string, OmniNode>()

    for (const node of nodes) {
      seen.set(node.id, node)
    }

    return Array.from(seen.values())
  }

  /**
   * 验证边的 source/target 存在，并去重
   */
  private validateAndDeduplicateEdges(
    edges: OmniEdge[],
    nodes: OmniNode[]
  ): { validEdges: OmniEdge[]; skippedEdges: number } {
    const nodeIds = new Set(nodes.map(n => n.id))
    const seen = new Map<string, OmniEdge>()
    let skippedEdges = 0

    for (const edge of edges) {
      // 验证 source 和 target 存在
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        skippedEdges++
        continue
      }

      // 去重
      if (!seen.has(edge.id)) {
        seen.set(edge.id, edge)
      }
    }

    return {
      validEdges: Array.from(seen.values()),
      skippedEdges,
    }
  }

  /**
   * 从数据库加载完整的图
   */
  loadGraph(): OmniGraph {
    return this.db.loadGraph()
  }

  /**
   * 清空图
   */
  clearGraph(): boolean {
    return this.db.clearGraph()
  }
}
