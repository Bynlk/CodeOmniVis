/**
 * runAnalysis — 一键分析项目
 *
 * 封装完整的分析流程：扫描文件 → 解析 → 跨层连线 → 存储。
 * 供 CLI、MCP、Server 共同调用。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ProjectMeta } from '@omnivis/shared'
import { OmniDatabase } from '../storage/db'
import { GraphBuilder } from './builder'
import { CrossLayerLinker } from '../resolver/crossLayer'
import { PrismaParser } from '../parsers/prisma'
import { NextjsAppParser } from '../parsers/nextjsApp'
import { NextjsPagesParser } from '../parsers/nextjsPages'
import { TrpcParser } from '../parsers/trpc'
import { ExpressParser } from '../parsers/express'
import { TypeormParser } from '../parsers/typeorm'
import { ApiCallsParser } from '../parsers/apiCalls'
import { ReactComponentParser } from '../parsers/reactComponent'
import { NestjsControllerParser } from '../parsers/nestjs/nestjsControllerParser'
import { NestjsModuleParser } from '../parsers/nestjs/nestjsModuleParser'
import { NestjsServiceParser } from '../parsers/nestjs/nestjsServiceParser'
import { DrizzleParser } from '../parsers/drizzle'

export interface RunAnalysisOptions {
  projectRoot: string
  dbPath: string
  projectMeta?: ProjectMeta
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
  const { projectRoot, dbPath, projectMeta: providedMeta } = options
  const projectMeta = providedMeta ?? detectProjectMeta(projectRoot)

  // 初始化数据库
  const db = new OmniDatabase(dbPath)
  await db.ready()

  // 创建图构建器
  const builder = new GraphBuilder(db)
  builder.registerParsers([
    new PrismaParser(),
    new NextjsAppParser(),
    new NextjsPagesParser(),
    new TrpcParser(),
    new ExpressParser(),
    new TypeormParser(),
    new ApiCallsParser(),
    new ReactComponentParser(),
    new NestjsControllerParser(),
    new NestjsModuleParser(),
    new NestjsServiceParser(),
    new DrizzleParser(),
  ])

  // 扫描文件
  const files: string[] = []

  // 添加 Prisma schema
  if (projectMeta.prismaSchemaPath && fs.existsSync(projectMeta.prismaSchemaPath)) {
    files.push(projectMeta.prismaSchemaPath)
  }

  // 扫描常见目录
  const scanDirs = ['app', 'src/app', 'pages', 'src/pages', 'components', 'src/components', 'server', 'src/server']
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

  if (crossLayerResult.edges.length > 0) {
    db.upsertEdges(crossLayerResult.edges)
    edgesCreated += crossLayerResult.edges.length
  }

  // 持久化
  db.close()

  return {
    filesScanned: files.length,
    nodesCreated,
    edgesCreated,
    crossLayerEdges: crossLayerResult.edges.length,
    errors,
  }
}
