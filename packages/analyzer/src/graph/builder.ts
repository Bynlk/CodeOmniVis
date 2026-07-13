/**
 * 图构建器
 *
 * 合并多个 Parser 的输出，去重，写入数据库。
 * 遵循"边的 source/target 必须存在"原则。
 */

import * as fs from 'fs'
import * as path from 'path'
import type {
  OmniGraph,
  OmniNode,
  OmniEdge,
  ParseResult,
  Parser,
  ParseContext,
} from '@codeomnivis/shared'
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

    // 后处理：所有节点→组件 renders 边（跨 package 连接）
    const componentEdges = this.linkComponents(uniqueNodes, context.projectRoot)
    allEdges.push(...componentEdges)

    // 验证边的 source/target 存在，并去重
    const { validEdges, skippedEdges } = this.validateAndDeduplicateEdges(allEdges, uniqueNodes)

    // 写入数据库
    this.db.upsertNodes(uniqueNodes)
    this.db.upsertEdges(validEdges)
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
      // calls_api 边允许 source/target 不存在（CrossLayerLinker 会后续修复）
      if (edge.type !== 'calls_api') {
        // 验证 source 和 target 存在
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
          skippedEdges++
          continue
        }
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
   * 通用组件连接：扫描所有节点的源文件，匹配 JSX→组件关系
   * 支持页面、组件、handler 等所有节点类型
   * 使用正则匹配（轻量级，不依赖 ts-morph）
   */
  private linkComponents(nodes: OmniNode[], projectRoot: string): OmniEdge[] {
    const edges: OmniEdge[] = []

    // 构建组件名→节点映射
    const componentMap = new Map<string, OmniNode[]>()
    for (const node of nodes) {
      if (node.type === 'component') {
        const existing = componentMap.get(node.name) || []
        existing.push(node)
        componentMap.set(node.name, existing)
      }
    }

    // 构建已有的 renders 边集合（避免重复）
    const existingRenders = new Set<string>()

    // 路由节点描述 URL，页面组件描述实现。先连接这两个层级，避免二者同时
    // 扫描同一 page.tsx 后各自扇出到相同子组件。
    const pageComponentsByFile = new Map<string, OmniNode[]>()
    for (const node of nodes) {
      if (node.type !== 'component' || !node.metadata.isPage) continue
      pageComponentsByFile.set(node.filePath, [
        ...(pageComponentsByFile.get(node.filePath) ?? []),
        node,
      ])
    }
    for (const node of nodes) {
      if (node.type !== 'page') continue
      for (const component of pageComponentsByFile.get(node.filePath) ?? []) {
        const edgeId = `${node.id}--renders--${component.id}`
        existingRenders.add(edgeId)
        edges.push({
          id: edgeId,
          source: node.id,
          target: component.id,
          type: 'renders',
          confidence: 'certain',
          metadata: {},
        })
      }
    }

    // 需要扫描的节点类型
    const scanTypes = new Set(['page', 'component', 'handler'])
    const scanNodes = nodes.filter(n =>
      scanTypes.has(n.type)
      && !(n.type === 'page' && pageComponentsByFile.has(n.filePath))
    )

    for (const node of scanNodes) {
      try {
        const fullPath = path.resolve(projectRoot, node.filePath)
        if (!fs.existsSync(fullPath)) continue

        const content = fs.readFileSync(fullPath, 'utf-8')

        // 解析 import：组件名 → 是否已导入
        const importedNames = new Set<string>()
        const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g
        let m: RegExpExecArray | null

        while ((m = importRegex.exec(content)) !== null) {
          if (m[0].includes('import type')) continue
          const named = m[1]
          const def = m[2]
          if (named) {
            for (const n of named.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())) {
              if (n && /^[A-Z]/.test(n)) importedNames.add(n)
            }
          }
          if (def && /^[A-Z]/.test(def)) importedNames.add(def)
        }

        // 查找 JSX 使用
        const jsxRegex = /<([A-Z]\w*)(?:[\s/>])/g
        const usedComponents = new Set<string>()
        while ((m = jsxRegex.exec(content)) !== null) {
          const tag = m[1]
          if (!['Fragment', 'Suspense', 'ErrorBoundary', 'Head', 'Script'].includes(tag)) {
            usedComponents.add(tag)
          }
        }

        // 创建 renders 边
        for (const compName of usedComponents) {
          if (!importedNames.has(compName)) continue
          const candidates = componentMap.get(compName)
          if (!candidates || candidates.length === 0) continue

          // 优先选择同目录或相近路径的组件
          const compNode = candidates.find(c => c.filePath !== node.filePath) || candidates[0]
          if (compNode.id === node.id) continue

          const edgeId = `${node.id}--renders--${compNode.id}`
          if (!existingRenders.has(edgeId)) {
            existingRenders.add(edgeId)
            edges.push({
              id: edgeId,
              source: node.id,
              target: compNode.id,
              type: 'renders',
              confidence: 'inferred',
              metadata: {},
            })
          }
        }
      } catch {
        // 降级
      }
    }

    return edges
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
