/**
 * runAnalysis — 一键分析项目
 *
 * 封装完整的分析流程：扫描文件 → 解析 → 跨层连线 → 存储。
 * 供 CLI、MCP、Server 共同调用。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ProjectMeta } from '@codeomnivis/shared'
import { OmniDatabase } from '../storage/db'
import { GraphBuilder } from './builder'
import { CrossLayerLinker } from '../resolver/crossLayer'
import { createDefaultParsers } from './createDefaultParsers'
import { collectAnalysisFiles } from './collectAnalysisFiles'
import { AnalysisError } from './analysisError'

export interface RunAnalysisOptions {
  projectRoot: string
  dbPath: string
  projectMeta?: ProjectMeta
  /**
   * 复用调用方持有的数据库实例。
   * 提供时:分析结果直接写入该实例,且分析结束后不关闭(由调用方管理生命周期)。
   * 省略时:按 dbPath 自建实例并在结束时关闭(CLI/一次性场景)。
   * 修复 RACE-01:server 用 :memory: 时必须共享同一句柄,否则查询层读不到分析结果。
   */
  db?: OmniDatabase
  /** Reports the canonical input count without requiring callers to scan a second time. */
  onFilesCollected?: (count: number) => void
}

export interface RunAnalysisResult {
  filesScanned: number
  nodesCreated: number
  edgesCreated: number
  crossLayerEdges: number
  errors: number
}

/**
 * 自动检测项目元数据（简化版）
 */
function detectProjectMeta(projectRoot: string): ProjectMeta {
  return {
    root: projectRoot,
    frontendFramework: 'next',
    backendFramework: 'trpc',
    databaseType: 'prisma',
    monorepoType: 'none',
    packages: [],
    frontendDirs: [],
    backendDirs: [],
    trpcRouterPaths: [],
    tsrpcServicePaths: [],
    tsrpcApiDirs: [],
    tsrpcProtocolDirs: [],
    prismaSchemaPath: fs.existsSync(path.join(projectRoot, 'prisma', 'schema.prisma'))
      ? path.join(projectRoot, 'prisma', 'schema.prisma')
      : null,
    typeormEntityDirs: [],
    tsConfigPath: fs.existsSync(path.join(projectRoot, 'tsconfig.json'))
      ? path.join(projectRoot, 'tsconfig.json')
      : null,
    buildFile: null,
  }
}

/**
 * 执行完整的项目分析
 */
export async function runAnalysis(options: RunAnalysisOptions): Promise<RunAnalysisResult> {
  const { projectRoot, dbPath, projectMeta: providedMeta, db: injectedDb, onFilesCollected } = options
  const projectMeta = providedMeta ?? detectProjectMeta(projectRoot)
  const files = collectAnalysisFiles(projectRoot, projectMeta)
  onFilesCollected?.(files.length)

  if (files.length === 0) {
    throw new AnalysisError(
      'NO_SUPPORTED_FILES',
      `No supported source files found under ${path.resolve(projectRoot)}. `
        + 'Check the project root or configure frontend/backend source directories in .codeomnivis.json.',
    )
  }

  // 初始化数据库:优先复用调用方注入的实例(共享句柄,修复 RACE-01);
  // 否则按 dbPath 自建并在结束时关闭。
  const ownsDb = injectedDb === undefined
  const db = injectedDb ?? new OmniDatabase(dbPath)
  try {
    await db.ready()

    // 每次完整重分析都替换整个图，避免已删除或改名文件遗留在可视化中。
    // 解析失败仍由各 parser 以错误记录降级，不抛出中断本轮分析。
    db.clearGraph()

    const builder = new GraphBuilder(db)
    builder.registerParsers(createDefaultParsers())

    const result = await builder.parseFiles(files, {
      projectRoot,
      projectMeta,
      tsConfig: null,
      pathAliases: {},
    })
    let nodesCreated = result.stats.totalNodes
    let edgesCreated = result.stats.totalEdges

    const tsConfigPath = projectMeta.tsConfigPath ?? undefined
    const linker = new CrossLayerLinker(tsConfigPath, projectRoot)
    const graph = builder.loadGraph()
    const crossLayerResult = await linker.link(graph)

    // 先落库 synthetic 节点,再写跨层边,避免 dangling edge(E-08)
    if (crossLayerResult.nodes.length > 0) {
      db.upsertNodes(crossLayerResult.nodes)
      nodesCreated += crossLayerResult.nodes.length
    }
    if (crossLayerResult.edges.length > 0) {
      db.upsertEdges(crossLayerResult.edges)
      edgesCreated += crossLayerResult.edges.length
    }
    db.removeDanglingEdges()

    if (db.getAllNodes().length === 0) {
      throw new AnalysisError(
        'NO_GRAPH_NODES',
        `Scanned ${files.length} supported file(s) under ${path.resolve(projectRoot)}, `
          + 'but no supported architecture nodes were recognized.',
      )
    }

    return {
      filesScanned: files.length,
      nodesCreated,
      edgesCreated,
      crossLayerEdges: crossLayerResult.edges.length,
      errors: result.stats.totalErrors,
    }
  } finally {
    // 持久化:仅在自建实例时关闭;注入实例的生命周期由调用方管理。
    if (ownsDb) db.close()
  }
}
