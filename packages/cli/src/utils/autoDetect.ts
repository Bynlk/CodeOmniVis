/**
 * 项目自动检测工具
 *
 * 检测项目使用的框架、ORM、monorepo 类型等。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ProjectMeta, FrameworkType, DatabaseType, MonorepoType } from '@omnivis/shared'
import { detectGradleFrameworks } from './gradleDetect'

// ============================================================
// 检测函数
// ============================================================

/**
 * 自动检测项目结构
 */
export async function autoDetectProject(root: string): Promise<ProjectMeta> {
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    : {}

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // 检测框架（TypeScript 项目）
  const frontendFramework = detectFrontendFramework(dependencies)
  let backendFramework = detectBackendFramework(dependencies)
  let databaseType = detectDatabaseType(root, dependencies)
  const monorepoType = detectMonorepoType(root)

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
  if (dependencies['@trpc/server']) return 'trpc'
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

/**
 * 查找 Prisma schema 文件
 */
function findPrismaSchema(root: string): string | null {
  const possiblePaths = [
    'prisma/schema.prisma',
    'schema.prisma',
    'src/prisma/schema.prisma',
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(root, p))) {
      return p
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
 * 扫描 server/routers/、src/server/routers/ 等常见目录
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
      // 查找目录下的 .ts/.tsx 文件
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
