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
}

export interface RunAnalysisResult {
  filesScanned: number
  nodesCreated: number
  edgesCreated: number
  crossLayerEdges: number
  errors: number
}

/**
 * 递归扫描目录中的 TS/JS 文件
 */
function scanDir(dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      scanDir(fullPath, files)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
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
  const { projectRoot, dbPath, projectMeta: providedMeta, db: injectedDb } = options
  const projectMeta = providedMeta ?? detectProjectMeta(projectRoot)

  // 初始化数据库:优先复用调用方注入的实例(共享句柄,修复 RACE-01);
  // 否则按 dbPath 自建并在结束时关闭。
  const ownsDb = injectedDb === undefined
  const db = injectedDb ?? new OmniDatabase(dbPath)
  await db.ready()

  // 创建图构建器
  const builder = new GraphBuilder(db)
  builder.registerParsers(createDefaultParsers())

  // 扫描文件
  const files: string[] = []

  // 添加 Prisma schema
  if (projectMeta.prismaSchemaPath && fs.existsSync(projectMeta.prismaSchemaPath)) {
    files.push(projectMeta.prismaSchemaPath)
  }

  // 扫描常见目录
  const scanDirs = ['app', 'src/app', 'pages', 'src/pages', 'components', 'src/components', 'server', 'src/server']

  // TSRPC 项目：扫描 api/ 和 shared/protocols/ 目录
  if (projectMeta.backendFramework === 'tsrpc') {
    scanDirs.push('src/api', 'api', 'src/shared/protocols', 'shared/protocols', 'protocols', 'src/protocols')
  }
  for (const dir of scanDirs) {
    scanDir(path.join(projectRoot, dir), files)
  }

  let nodesCreated = 0
  let edgesCreated = 0
  let errors = 0

  // 执行解析
  if (files.length > 0) {
    const result = await builder.parseFiles(files, {
      projectRoot,
      projectMeta,
      tsConfig: null,
      pathAliases: {},
    })
    nodesCreated = result.stats.totalNodes
    edgesCreated = result.stats.totalEdges
    errors = result.stats.totalErrors
  }

  // 跨层连线
  const tsConfigPath = projectMeta.tsConfigPath ?? undefined
  const linker = new CrossLayerLinker(tsConfigPath)
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

  // 持久化:仅在自建实例时关闭;注入实例的生命周期由调用方管理。
  if (ownsDb) {
    db.close()
  }

  return {
    filesScanned: files.length,
    nodesCreated,
    edgesCreated,
    crossLayerEdges: crossLayerResult.edges.length,
    errors,
  }
}
