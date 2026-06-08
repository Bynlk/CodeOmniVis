/**
 * 项目自动检测工具
 *
 * 检测项目使用的框架、ORM、monorepo 类型等。
 * 支持通过 .codeomnivis.json 配置覆盖自动检测结果。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ProjectMeta, FrameworkType, DatabaseType, MonorepoType, CodeOmniVisConfig } from '@codeomnivis/shared'
import { detectGradleFrameworks } from './gradleDetect'

// ============================================================
// 检测函数
// ============================================================

/**
 * 自动检测项目结构（支持配置覆盖）
 */
export async function autoDetectProject(root: string, config?: CodeOmniVisConfig): Promise<ProjectMeta> {
  const detected = await doAutoDetect(root)

  if (config) {
    // 前端框架覆盖
    if (config.frontend?.framework && config.frontend.framework !== 'auto') {
      detected.frontendFramework = config.frontend.framework as FrameworkType
    }
    // 前端目录覆盖
    if (config.frontend?.dirs && config.frontend.dirs.length > 0) {
      detected.frontendDirs = config.frontend.dirs.map(d => path.resolve(root, d))
    }
    // 后端目录覆盖
    if (config.backend?.dirs && config.backend.dirs.length > 0) {
      detected.backendDirs = config.backend.dirs.map(d => path.resolve(root, d))
    }
    // Prisma schema 路径覆盖
    if (config.database?.prismaSchema) {
      detected.prismaSchemaPath = path.resolve(root, config.database.prismaSchema)
    }
    // TypeORM entity 目录覆盖
    if (config.database?.typeormDirs && config.database.typeormDirs.length > 0) {
      detected.typeormEntityDirs = config.database.typeormDirs
    }
  }

  return detected
}

/**
 * 内部自动检测实现
 */
async function doAutoDetect(root: string): Promise<ProjectMeta> {
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    : {}

  // 收集依赖：根目录 + 主应用（monorepo 场景）
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // monorepo：合并 apps/web/package.json 的依赖
  const monorepoType = detectMonorepoType(root)
  if (monorepoType !== 'none') {
    const mainAppPkgPaths = [
      path.join(root, 'apps', 'web', 'package.json'),
      path.join(root, 'app', 'package.json'),
    ]
    for (const p of mainAppPkgPaths) {
      if (fs.existsSync(p)) {
        const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'))
        Object.assign(dependencies, pkg.dependencies, pkg.devDependencies)
        break
      }
    }
  }

  // 检测框架（TypeScript 项目）
  const frontendFramework = detectFrontendFramework(dependencies)
  let backendFramework = detectBackendFramework(dependencies)

  // tsrpc.config.ts 存在也表示 TSRPC 项目
  if (backendFramework === 'unknown' && fs.existsSync(path.join(root, 'tsrpc.config.ts'))) {
    backendFramework = 'tsrpc'
  }

  let databaseType = detectDatabaseType(root, dependencies)

  // 检测 Kotlin/Gradle 项目
  const gradleInfo = detectGradleFrameworks(root)
  if (gradleInfo.backendFramework !== 'unknown' && backendFramework === 'unknown') {
    backendFramework = gradleInfo.backendFramework
  }
  if (gradleInfo.databaseType !== 'unknown' && databaseType === 'unknown') {
    databaseType = gradleInfo.databaseType
  }

  // 检测 Prisma schema
  const prismaSchemaPath = findPrismaSchema(root)

  // 检测 tRPC router 路径
  const trpcRouterPaths = findTrpcRouterPaths(root)

  // 检测 TSRPC 路径
  const tsrpcServicePaths = findTsrpcServicePaths(root)
  const tsrpcPaths = findTsrpcPaths(root)

  // 检测 TypeORM entity 目录
  const typeormEntityDirs = findTypeormEntityDirs(root)

  return {
    root,
    frontendFramework,
    backendFramework,
    databaseType,
    monorepoType,
    frontendDirs: ['app', 'src/app', 'pages', 'src/pages'],
    backendDirs: ['server', 'src/server', 'api', 'src/api'],
    trpcRouterPaths,
    tsrpcServicePaths,
    tsrpcApiDirs: tsrpcPaths.apiDirs,
    tsrpcProtocolDirs: tsrpcPaths.protocolDirs,
    tsrpcServiceProto: tsrpcPaths.serviceProto,
    prismaSchemaPath,
    typeormEntityDirs,
    tsConfigPath: findTsConfig(root) ?? null,
    buildFile: gradleInfo.buildFile,
    packages: [],
  }
}

/**
 * 检测前端框架
 */
function detectFrontendFramework(dependencies: Record<string, string>): FrameworkType {
  if (dependencies['next']) return 'next'
  if (dependencies['react']) return 'unknown' // React 但不是 Next.js
  return 'unknown'
}

/**
 * 检测后端框架
 */
function detectBackendFramework(dependencies: Record<string, string>): FrameworkType {
  if (dependencies['@nestjs/core'] || dependencies['@nestjs/common']) return 'nestjs'
  // 检查 @trpc/server 或 workspace tRPC 包（如 @calcom/trpc）
  if (dependencies['@trpc/server']) return 'trpc'
  for (const dep of Object.keys(dependencies)) {
    if (dep.endsWith('/trpc') || dep === 'trpc') return 'trpc'
  }
  if (dependencies['tsrpc'] || dependencies['tsrpc-browser'] || dependencies['tsrpc-base-client']) return 'tsrpc'
  if (dependencies['express']) return 'express'
  return 'unknown'
}

/**
 * 检测数据库 ORM
 */
function detectDatabaseType(root: string, dependencies: Record<string, string>): DatabaseType {
  // 检查 Prisma schema 文件
  if (findPrismaSchema(root)) return 'prisma'

  // 检查 package.json 依赖
  if (dependencies['prisma'] || dependencies['@prisma/client']) return 'prisma'
  if (dependencies['drizzle-orm']) return 'drizzle'
  if (dependencies['typeorm']) return 'typeorm'

  return 'unknown'
}

/**
 * 检测 monorepo 类型
 */
function detectMonorepoType(root: string): MonorepoType {
  if (fs.existsSync(path.join(root, 'turbo.json'))) return 'turborepo'
  if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) return 'pnpm'
  return 'none'
}

// 查找 monorepo 根目录（向上查找包含 packages/ 的目录）
function findMonorepoRoot(root: string): string | null {
  let current = path.resolve(root)
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(current, 'packages')) && fs.existsSync(path.join(current, 'package.json'))) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

// 查找 Prisma schema 文件
// 支持标准路径和 monorepo 路径 (packages/xxx/prisma/schema.prisma)
function findPrismaSchema(root: string): string | null {
  // 标准路径
  const standardPaths = [
    'prisma/schema.prisma',
    'schema.prisma',
    'src/prisma/schema.prisma',
  ]

  for (const p of standardPaths) {
    if (fs.existsSync(path.join(root, p))) {
      return p
    }
  }

  // 搜索 monorepo 根目录（支持从 apps/web 等子目录运行）
  const searchRoots = [root]
  const monorepoRoot = findMonorepoRoot(root)
  if (monorepoRoot && monorepoRoot !== root) {
    searchRoots.push(monorepoRoot)
  }

  for (const searchRoot of searchRoots) {
    // monorepo 常见路径
    const monorepoPaths = [
      'packages/prisma/prisma/schema.prisma',
      'packages/prisma/schema.prisma',
      'packages/db/prisma/schema.prisma',
      'packages/database/prisma/schema.prisma',
    ]

    for (const p of monorepoPaths) {
      const full = path.join(searchRoot, p)
      if (fs.existsSync(full)) {
        return full
      }
    }

    // glob 搜索：packages/*/prisma/schema.prisma
    const packagesDir = path.join(searchRoot, 'packages')
    if (fs.existsSync(packagesDir)) {
      try {
        const entries = fs.readdirSync(packagesDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          // packages/*/prisma/schema.prisma
          const candidate = path.join(packagesDir, entry.name, 'prisma', 'schema.prisma')
          if (fs.existsSync(candidate)) return candidate
          // packages/*/*/schema.prisma (e.g. packages/db/prisma/schema.prisma)
          const subDir = path.join(packagesDir, entry.name)
          try {
            const subEntries = fs.readdirSync(subDir, { withFileTypes: true })
            for (const subEntry of subEntries) {
              if (!subEntry.isDirectory()) continue
              const deepCandidate = path.join(subDir, subEntry.name, 'schema.prisma')
              if (fs.existsSync(deepCandidate)) return deepCandidate
            }
          } catch {
            // 忽略读取错误
          }
        }
      } catch {
        // 忽略读取错误
      }
    }
  }

  return null
}

/**
 * 查找 tsconfig.json
 * 优先查找 monorepo 前端包的 tsconfig
 */
export function findTsConfig(root: string): string | undefined {
  const candidates = [
    path.join(root, 'tsconfig.json'),
    path.join(root, 'apps', 'web', 'tsconfig.json'),
    path.join(root, 'app', 'tsconfig.json'),
    path.join(root, 'src', 'tsconfig.json'),
  ]
  return candidates.find(p => fs.existsSync(p))
}

/**
 * 查找 tRPC router 文件路径
 * 递归搜索包含 createTRPCRouter 或 router( 的 TS 文件
 * 支持 monorepo 结构（packages/trpc/、packages/server/ 等）
 */
function findTrpcRouterPaths(root: string): string[] {
  const possibleDirs = [
    'server/routers',
    'src/server/routers',
    'server/router',
    'src/server/router',
    'api/trpc',
    'src/api/trpc',
  ]

  const paths: string[] = []
  for (const dir of possibleDirs) {
    const fullPath = path.join(root, dir)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      try {
        const entries = fs.readdirSync(fullPath, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            paths.push(path.join(dir, entry.name))
          }
        }
      } catch {
        // 忽略读取错误
      }
    }
  }

  return paths
}

/**
 * 查找 TSRPC service 文件路径
 * 递归搜索包含 ApiCall 的 TS 文件
 */
function findTsrpcServicePaths(root: string): string[] {
  const possibleDirs = [
    'server/api',
    'src/server/api',
    'api',
    'src/api',
    'server/protocols',
    'src/server/protocols',
    'protocols',
    'src/protocols',
  ]

  const serviceFiles: string[] = []
  const visited = new Set<string>()

  for (const dir of possibleDirs) {
    const fullPath = path.join(root, dir)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      scanForTsrpcServices(fullPath, serviceFiles, visited)
    }
  }

  return serviceFiles
}

// 递归扫描目录，查找包含 ApiCall 的 TS 文件
function scanForTsrpcServices(dir: string, results: string[], visited: Set<string>): void {
  const absDir = path.resolve(dir)
  if (visited.has(absDir)) return
  visited.add(absDir)

  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(absDir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        scanForTsrpcServices(fullPath, results, visited)
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          if (content.includes('ApiCall') || content.includes('tsrpc')) {
            results.push(fullPath)
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  } catch {
    // 忽略读取错误
  }
}

/**
 * 查找 TSRPC 项目路径
 * 返回 api 目录、protocol 目录、serviceProto.ts 路径
 */
function findTsrpcPaths(root: string): {
  apiDirs: string[]
  protocolDirs: string[]
  serviceProto?: string
} {
  const apiDirs: string[] = []
  const protocolDirs: string[] = []
  let serviceProto: string | undefined
  const visited = new Set<string>()

  // 搜索常见目录
  const searchDirs = [
    'src/api', 'api', 'src/server/api', 'server/api',
    'src/shared/protocols', 'shared/protocols', 'protocols', 'src/protocols',
  ]

  for (const dir of searchDirs) {
    const fullPath = path.join(root, dir)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      if (dir.includes('api')) apiDirs.push(fullPath)
      if (dir.includes('protocol')) protocolDirs.push(fullPath)
    }
  }

  // 递归搜索 Api*.ts、Ptl*.ts、serviceProto.ts
  function scanDir(dir: string): void {
    const absDir = path.resolve(dir)
    if (visited.has(absDir)) return
    visited.add(absDir)

    try {
      const entries = fs.readdirSync(absDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(absDir, entry.name)
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanDir(fullPath)
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          if (entry.name.startsWith('Api') && !apiDirs.includes(absDir)) {
            apiDirs.push(absDir)
          }
          if (entry.name.startsWith('Ptl') && !protocolDirs.includes(absDir)) {
            protocolDirs.push(absDir)
          }
          if (entry.name === 'serviceProto.ts' && !serviceProto) {
            serviceProto = fullPath
          }
        }
      }
    } catch { /* ignore */ }
  }

  // 扫描 src 目录
  const srcDir = path.join(root, 'src')
  if (fs.existsSync(srcDir)) scanDir(srcDir)

  return { apiDirs: [...new Set(apiDirs)], protocolDirs: [...new Set(protocolDirs)], serviceProto }
}

// 递归扫描目录，查找包含 createTRPCRouter 的 TS 文件（返回绝对路径）
function scanForRouters(dir: string, projectRoot: string, results: string[], visited: Set<string>): void {
  const absDir = path.resolve(dir)
  if (visited.has(absDir)) return
  visited.add(absDir)

  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(absDir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        scanForRouters(fullPath, projectRoot, results, visited)
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          if (content.includes('createTRPCRouter') || content.includes('router(')) {
            // 返回绝对路径
            results.push(fullPath)
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  } catch {
    // 忽略读取错误
  }
}

/**
 * 查找 TypeORM entity 文件目录
 * 扫描 entity/、entities/、model/、models/ 等常见目录
 */
function findTypeormEntityDirs(root: string): string[] {
  const possibleDirs = [
    'entity',
    'entities',
    'src/entity',
    'src/entities',
    'model',
    'models',
    'src/model',
    'src/models',
  ]

  const dirs: string[] = []
  for (const dir of possibleDirs) {
    const fullPath = path.join(root, dir)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      // 检查目录下是否有 .ts/.tsx 文件
      try {
        const entries = fs.readdirSync(fullPath, { withFileTypes: true })
        const hasTsFiles = entries.some(e => e.isFile() && /\.(ts|tsx)$/.test(e.name))
        if (hasTsFiles) {
          dirs.push(dir)
        }
      } catch {
        // 忽略读取错误
      }
    }
  }

  return dirs
}

/**
 * 递归收集包含 TS/TSX 文件的目录
 */
function collectTsDirs(dir: string, results: string[], depth: number, maxDepth: number): void {
  if (depth > maxDepth) return
  const skipDirs = ['node_modules', 'dist', '.next', '__tests__', '__mocks__', '.turbo']
  try {
    let hasTsFiles = false
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        hasTsFiles = true
        break
      }
    }
    if (hasTsFiles) results.push(dir)

    for (const entry of entries) {
      if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
        collectTsDirs(path.join(dir, entry.name), results, depth + 1, maxDepth)
      }
    }
  } catch {
    // ignore
  }
}

// 收集需要扫描的目录
// 当检测到 Turborepo/pnpm monorepo 时，自动加入 packages/*/src
export function collectScanDirs(root: string, config?: CodeOmniVisConfig): string[] {
  const dirs: string[] = []

  // 用户配置的目录（最高优先）
  if (config?.frontend?.dirs?.length) {
    dirs.push(...config.frontend.dirs.map(d => path.resolve(root, d)))
  }
  if (config?.backend?.dirs?.length) {
    dirs.push(...config.backend.dirs.map(d => path.resolve(root, d)))
  }

  // 主应用目录
  const mainAppCandidates = ['apps/web/src', 'apps/web', 'src', 'app']
  for (const c of mainAppCandidates) {
    const full = path.join(root, c)
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      dirs.push(full)
      break
    }
  }

  // 标准子目录（在主应用目录下）
  const standardSubDirs = ['pages', 'components', 'server', 'api']
  for (const sub of standardSubDirs) {
    for (const mainDir of dirs.slice()) {
      const full = path.join(mainDir, sub)
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        dirs.push(full)
      }
    }
  }

  // Turborepo/pnpm monorepo：自动加入 packages/ 下有 TS 文件的目录
  const hasTurbo = fs.existsSync(path.join(root, 'turbo.json'))
  const hasPnpmWorkspace = fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))
  if (hasTurbo || hasPnpmWorkspace) {
    const packagesDir = path.join(root, 'packages')
    if (fs.existsSync(packagesDir)) {
      try {
        const entries = fs.readdirSync(packagesDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const pkgDir = path.join(packagesDir, entry.name)
          // 收集包内所有包含 TS 文件的子目录（深度 2）
          collectTsDirs(pkgDir, dirs, 0, 2)
        }
      } catch {
        // 忽略读取错误
      }
    }
  }

  // 去重
  return [...new Set(dirs)]
}
