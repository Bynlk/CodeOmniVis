/**
 * runFullAnalysis — 完整项目分析（CLI 和 MCP 共用）
 *
 * 包含：自动检测 → 文件扫描 → 解析 → 跨层连线 → 持久化
 * 与 CLI serve 的分析逻辑完全一致。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { DatabaseType, FrameworkType, OmniNode, ProjectMeta } from '@codeomnivis/shared'
import { OmniDatabase } from '../storage/db'
import { GraphBuilder } from './builder'
import { CrossLayerLinker } from '../resolver/crossLayer'
import { PrismaParser } from '../parsers/prisma'
import { NextjsAppParser } from '../parsers/nextjsApp'
import { NextjsPagesParser } from '../parsers/nextjsPages'
import { TrpcParser } from '../parsers/trpc'
import { TsRpcParser } from '../parsers/tsrpc'
import { ExpressParser } from '../parsers/express'
import { TypeormParser } from '../parsers/typeorm'
import { ApiCallsParser } from '../parsers/apiCalls'
import { ReactComponentParser } from '../parsers/reactComponent'
import { NestjsControllerParser } from '../parsers/nestjs/nestjsControllerParser'
import { NestjsModuleParser } from '../parsers/nestjs/nestjsModuleParser'
import { NestjsServiceParser } from '../parsers/nestjs/nestjsServiceParser'
import { DrizzleParser } from '../parsers/drizzle'

function isSyntheticNode(node: OmniNode): boolean {
  return 'isSynthetic' in node.metadata && node.metadata.isSynthetic === true
}

export interface FullAnalysisOptions {
  projectRoot: string
  dbPath: string
}

export interface FullAnalysisResult {
  filesScanned: number
  nodesCreated: number
  edgesCreated: number
  crossLayerEdges: number
  errors: number
  projectMeta: ProjectMeta
}

/**
 * 自动检测项目元数据
 */
function detectProjectMeta(projectRoot: string): ProjectMeta {
  let frontendFramework: FrameworkType = 'unknown'
  let backendFramework: FrameworkType = 'unknown'
  let databaseType: DatabaseType = 'unknown'

  try {
    const pkgPath = path.join(projectRoot, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      // 前端框架
      if (deps['next']) frontendFramework = 'next'
      else if (deps['react']) frontendFramework = 'unknown'

      // 后端框架
      if (deps['tsrpc'] || deps['tsrpc-browser'] || deps['tsrpc-base-client']) backendFramework = 'tsrpc'
      else if (deps['@nestjs/core'] || deps['@nestjs/common']) backendFramework = 'nestjs'
      else if (deps['@trpc/server']) backendFramework = 'trpc'
      else if (deps['express']) backendFramework = 'express'

      // tsrpc.config.ts 也表示 TSRPC 项目
      if (backendFramework === 'unknown' && fs.existsSync(path.join(projectRoot, 'tsrpc.config.ts'))) {
        backendFramework = 'tsrpc'
      }

      // 数据库 ORM
      if (fs.existsSync(path.join(projectRoot, 'prisma', 'schema.prisma'))) databaseType = 'prisma'
      else if (deps['prisma'] || deps['@prisma/client']) databaseType = 'prisma'
      else if (deps['drizzle-orm']) databaseType = 'drizzle'
      else if (deps['typeorm']) databaseType = 'typeorm'
    }
  } catch { /* ignore */ }

  return {
    root: projectRoot,
    frontendFramework,
    backendFramework,
    databaseType,
    monorepoType: 'none',
    frontendDirs: ['app', 'src/app', 'pages', 'src/pages'],
    backendDirs: ['server', 'src/server', 'api', 'src/api'],
    trpcRouterPaths: [],
    tsrpcServicePaths: [],
    tsrpcApiDirs: [],
    tsrpcProtocolDirs: [],
    prismaSchemaPath: findPrismaSchema(projectRoot),
    typeormEntityDirs: [],
    tsConfigPath: findTsConfig(projectRoot) ?? null,
    buildFile: null,
    packages: [],
  }
}

function findPrismaSchema(root: string): string | null {
  const paths = ['prisma/schema.prisma', 'schema.prisma', 'src/prisma/schema.prisma']
  for (const p of paths) {
    if (fs.existsSync(path.join(root, p))) return path.join(root, p)
  }
  return null
}

function findTsConfig(root: string): string | undefined {
  const candidates = [
    path.join(root, 'tsconfig.json'),
    path.join(root, 'apps', 'web', 'tsconfig.json'),
    path.join(root, 'src', 'tsconfig.json'),
  ]
  return candidates.find(p => fs.existsSync(p))
}

/**
 * 递归扫描目录中的 TS/JS 文件
 * 跳过软链接目录（避免 symlink 重复扫描）
 */
function scanDir(dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      // 跳过软链接目录（避免 symlink 重复扫描）
      if (entry.isSymbolicLink()) continue
      scanDir(fullPath, files)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
}

/**
 * 收集扫描目录（含兄弟 frontend 目录）
 */
function collectScanDirs(projectRoot: string, meta: ProjectMeta): string[] {
  const dirs: string[] = []

  // 标准目录
  const candidates = ['src', 'app', 'pages', 'components', 'server', 'api']
  for (const c of candidates) {
    const full = path.join(projectRoot, c)
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      dirs.push(full)
    }
  }

  // 标准子目录
  const subDirs = ['pages', 'components', 'server', 'api', 'shared/protocols']
  for (const sub of subDirs) {
    for (const mainDir of dirs.slice()) {
      const full = path.join(mainDir, sub)
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        dirs.push(full)
      }
    }
  }

  // 兄弟 frontend 目录（monorepo 风格）
  const siblingDirs = ['../frontend/src', '../frontend']
  for (const sib of siblingDirs) {
    const full = path.resolve(projectRoot, sib)
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      dirs.push(full)
    }
  }

  // TSRPC 特有目录
  if (meta.backendFramework === 'tsrpc') {
    const tsrpcDirs = ['src/api', 'api', 'src/shared/protocols', 'shared/protocols', 'protocols', 'src/protocols']
    for (const d of tsrpcDirs) {
      const full = path.join(projectRoot, d)
      if (fs.existsSync(full) && fs.statSync(full).isDirectory() && !dirs.includes(full)) {
        dirs.push(full)
      }
    }
  }

  return [...new Set(dirs)]
}

/**
 * 执行完整的项目分析
 */
export async function runFullAnalysis(options: FullAnalysisOptions): Promise<FullAnalysisResult> {
  const { projectRoot, dbPath } = options
  const projectMeta = detectProjectMeta(projectRoot)

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
    new TsRpcParser(),
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

  // 扫描目录
  const scanDirs = collectScanDirs(projectRoot, projectMeta)
  for (const dir of scanDirs) {
    scanDir(dir, files)
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

    // 跨层连线
    const tsConfigPath = findTsConfig(projectRoot)
    const linker = new CrossLayerLinker(tsConfigPath)
    const graph = builder.loadGraph()
    const crossLayerResult = await linker.link(graph)

    if (crossLayerResult.edges.length > 0) {
      db.upsertEdges(crossLayerResult.edges)
      edgesCreated += crossLayerResult.edges.length
    }

    // 将跨层连线产生的 synthetic 节点写入 DB
      const syntheticNodes = graph.nodes.filter(isSyntheticNode)
    if (syntheticNodes.length > 0) {
      db.upsertNodes(syntheticNodes)
    }
  }

  db.close()

  return {
    filesScanned: files.length,
    nodesCreated,
    edgesCreated,
    crossLayerEdges: 0,
    errors,
    projectMeta,
  }
}
