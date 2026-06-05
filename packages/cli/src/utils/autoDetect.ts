/**
 * 项目自动检测工具
 *
 * 检测项目使用的框架、ORM、monorepo 类型等。
 * 基础版：检测 prisma schema。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ProjectMeta, FrameworkType, DatabaseType, MonorepoType } from '@omnivis/shared'

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

  // 检测框架
  const frontendFramework = detectFrontendFramework(dependencies)
  const backendFramework = detectBackendFramework(dependencies)
  const databaseType = detectDatabaseType(root, dependencies)
  const monorepoType = detectMonorepoType(root)

  // 检测 Prisma schema
  const prismaSchemaPath = findPrismaSchema(root)

  return {
    root,
    frontendFramework,
    backendFramework,
    databaseType,
    monorepoType,
    frontendDirs: ['app', 'src/app', 'pages', 'src/pages'],
    backendDirs: ['server', 'src/server', 'api', 'src/api'],
    trpcRouterPaths: [],
    prismaSchemaPath,
    typeormEntityDirs: [],
    tsConfigPath: findTsConfig(root),
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
 */
function findTsConfig(root: string): string | null {
  const possiblePaths = [
    'tsconfig.json',
    'tsconfig.base.json',
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(root, p))) {
      return p
    }
  }

  return null
}
