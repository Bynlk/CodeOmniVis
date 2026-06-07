/**
 * 文件分类器
 *
 * 根据文件路径和项目元数据判断文件类型。
 * 支持：Next.js Pages/App Router、tRPC、Express
 */

import type { ProjectMeta } from '@codeomnivis/shared'

// ============================================================
// 文件类型枚举
// ============================================================

export type FileType =
  | 'nextjs_page'
  | 'nextjs_api_route'
  | 'nextjs_layout'
  | 'nextjs_loading'
  | 'nextjs_error'
  | 'trpc_router'
  | 'express_route'
  | 'react_component'
  | 'prisma_schema'
  | 'typeorm_entity'
  | 'unknown'

// ============================================================
// 分类结果
// ============================================================

export interface ClassificationResult {
  type: FileType
  confidence: 'certain' | 'inferred'
  metadata?: Record<string, unknown>
}

// ============================================================
// 分类器
// ============================================================

/**
 * 对文件进行分类
 */
export function classifyFile(filePath: string, projectMeta: ProjectMeta): ClassificationResult {
  // 规范化路径（处理 Windows 反斜杠）
  const normalizedPath = filePath.replace(/\\/g, '/')

  // Prisma Schema
  if (normalizedPath.endsWith('.prisma')) {
    return { type: 'prisma_schema', confidence: 'certain' }
  }

  // TypeORM Entity
  if (isTypeormEntity(normalizedPath, projectMeta)) {
    return { type: 'typeorm_entity', confidence: 'inferred' }
  }

  // Next.js App Router
  if (isNextjsAppRouter(normalizedPath)) {
    return classifyNextjsAppRouter(normalizedPath)
  }

  // Next.js Pages Router
  if (isNextjsPagesRouter(normalizedPath, projectMeta)) {
    return classifyNextjsPagesRouter(normalizedPath)
  }

  // tRPC Router
  if (isTrpcRouter(normalizedPath, projectMeta)) {
    return { type: 'trpc_router', confidence: 'inferred' }
  }

  // Express Route
  if (isExpressRoute(normalizedPath, projectMeta)) {
    return { type: 'express_route', confidence: 'inferred' }
  }

  // React Component（默认 .tsx/.jsx 文件）
  if (normalizedPath.endsWith('.tsx') || normalizedPath.endsWith('.jsx')) {
    return { type: 'react_component', confidence: 'inferred' }
  }

  return { type: 'unknown', confidence: 'inferred' }
}

// ============================================================
// Next.js App Router 判断
// ============================================================

/**
 * 判断是否是 Next.js App Router 文件
 * 路径模式：app/xxx/page.tsx, app/xxx/route.ts, app/xxx/layout.tsx
 */
function isNextjsAppRouter(filePath: string): boolean {
  // 匹配 app/ 目录下的特殊文件
  const appRouterPattern = /(?:^|\/)app\/.*(?:page|route|layout|loading|error)\.(?:tsx|ts|jsx|js)$/
  return appRouterPattern.test(filePath)
}

/**
 * 对 Next.js App Router 文件进行细分
 */
function classifyNextjsAppRouter(filePath: string): ClassificationResult {
  if (/\/page\.(tsx|ts|jsx|js)$/.test(filePath)) {
    return { type: 'nextjs_page', confidence: 'certain' }
  }

  if (/\/route\.(tsx|ts|jsx|js)$/.test(filePath)) {
    return { type: 'nextjs_api_route', confidence: 'certain' }
  }

  if (/\/layout\.(tsx|ts|jsx|js)$/.test(filePath)) {
    return { type: 'nextjs_layout', confidence: 'certain' }
  }

  if (/\/loading\.(tsx|ts|jsx|js)$/.test(filePath)) {
    return { type: 'nextjs_loading', confidence: 'certain' }
  }

  if (/\/error\.(tsx|ts|jsx|js)$/.test(filePath)) {
    return { type: 'nextjs_error', confidence: 'certain' }
  }

  return { type: 'unknown', confidence: 'inferred' }
}

// ============================================================
// Next.js Pages Router 判断
// ============================================================

/**
 * 判断是否是 Next.js Pages Router 文件
 * 路径模式：pages/xxx/yyy.tsx (排除 pages/api/)
 */
function isNextjsPagesRouter(filePath: string, projectMeta: ProjectMeta): boolean {
  // 只有当前端框架是 Next.js 时才判断
  if (projectMeta.frontendFramework !== 'next') {
    return false
  }

  // 匹配 pages/ 目录下的 .tsx/.ts 文件
  const pagesPattern = /(?:^|\/)pages\/.*\.(tsx|ts|jsx|js)$/
  return pagesPattern.test(filePath)
}

/**
 * 对 Next.js Pages Router 文件进行细分
 */
function classifyNextjsPagesRouter(filePath: string): ClassificationResult {
  // pages/api/ 下的是 API 路由
  if (/\/pages\/api\//.test(filePath)) {
    return { type: 'nextjs_api_route', confidence: 'certain' }
  }

  // 其他是页面路由
  return { type: 'nextjs_page', confidence: 'certain' }
}

// ============================================================
// tRPC Router 判断
// ============================================================

/**
 * 判断是否是 tRPC Router 文件
 * 基于文件名和项目依赖
 */
function isTrpcRouter(filePath: string, projectMeta: ProjectMeta): boolean {
  // 只有当后端框架是 tRPC 时才判断
  if (projectMeta.backendFramework !== 'trpc') {
    return false
  }

  // 文件名包含 router
  if (/router\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return true
  }

  // 路径包含 trpc
  if (/\/trpc\//.test(filePath)) {
    return true
  }

  return false
}

// ============================================================
// Express Route 判断
// ============================================================

/**
 * 判断是否是 Express Route 文件
 * 基于文件路径和项目依赖
 */
function isExpressRoute(filePath: string, projectMeta: ProjectMeta): boolean {
  // 只有当后端框架是 Express 时才判断
  if (projectMeta.backendFramework !== 'express') {
    return false
  }

  // 路径包含 routes
  if (/\/routes\//.test(filePath)) {
    return true
  }

  // 文件名包含 route
  if (/route[s]?\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return true
  }

  return false
}

// ============================================================
// TypeORM Entity 判断
// ============================================================

/**
 * 判断是否是 TypeORM Entity 文件
 * 基于文件路径和项目依赖
 */
function isTypeormEntity(filePath: string, projectMeta: ProjectMeta): boolean {
  // 只有当数据库类型是 TypeORM 时才判断
  if (projectMeta.databaseType !== 'typeorm') {
    return false
  }

  // 路径包含 entity/entities
  if (/\/entit(y|ies)\//.test(filePath)) {
    return true
  }

  return false
}
