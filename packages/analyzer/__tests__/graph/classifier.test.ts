/**
 * 文件分类器测试
 */

import { describe, it, expect } from 'vitest'
import { classifyFile } from '../../src/classifier'
import type { ProjectMeta } from '@codeomnivis/shared'

const baseMeta: ProjectMeta = {
  root: '/project',
  frontendFramework: 'next',
  backendFramework: 'trpc',
  databaseType: 'prisma',
  monorepoType: 'none',
  frontendDirs: ['app'],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
  prismaSchemaPath: 'prisma/schema.prisma',
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
}

function withProjectMeta(overrides: Partial<ProjectMeta>): ProjectMeta {
  return { ...baseMeta, ...overrides }
}

describe('classifyFile', () => {
  // ─── Prisma ───
  it('识别 prisma schema 文件', () => {
    expect(classifyFile('prisma/schema.prisma', baseMeta)).toEqual({ type: 'prisma_schema', confidence: 'certain' })
  })

  // ─── Next.js App Router ───
  it('识别 nextjs page', () => {
    expect(classifyFile('app/page.tsx', baseMeta).type).toBe('nextjs_page')
    expect(classifyFile('app/booking/page.tsx', baseMeta).type).toBe('nextjs_page')
  })

  it('识别 nextjs api route', () => {
    expect(classifyFile('app/api/route.ts', baseMeta).type).toBe('nextjs_api_route')
    expect(classifyFile('app/api/booking/route.ts', baseMeta).type).toBe('nextjs_api_route')
  })

  it('识别 nextjs layout', () => {
    expect(classifyFile('app/layout.tsx', baseMeta).type).toBe('nextjs_layout')
  })

  it('识别 nextjs loading', () => {
    expect(classifyFile('app/loading.tsx', baseMeta).type).toBe('nextjs_loading')
  })

  it('识别 nextjs error', () => {
    expect(classifyFile('app/error.tsx', baseMeta).type).toBe('nextjs_error')
  })

  // ─── Next.js Pages Router ───
  it('识别 pages router 页面', () => {
    const meta = withProjectMeta({ frontendFramework: 'next' })
    expect(classifyFile('pages/index.tsx', meta).type).toBe('nextjs_page')
    expect(classifyFile('pages/about.tsx', meta).type).toBe('nextjs_page')
  })

  it('识别 pages router API 路由', () => {
    const meta = withProjectMeta({ frontendFramework: 'next' })
    // classifyNextjsPagesRouter 的正则 /\/pages\/api\// 需要前导 /
    expect(classifyFile('/pages/api/users.ts', meta).type).toBe('nextjs_api_route')
    expect(classifyFile('src/pages/api/users.ts', meta).type).toBe('nextjs_api_route')
  })

  it('非 next 项目不识别 pages 文件', () => {
    const meta = withProjectMeta({ frontendFramework: 'unknown' })
    expect(classifyFile('pages/index.tsx', meta).type).toBe('react_component')
  })

  // ─── tRPC Router ───
  it('识别 trpc router 文件', () => {
    const meta = withProjectMeta({ backendFramework: 'trpc' })
    // 文件名包含 router
    expect(classifyFile('server/routers/user.router.ts', meta).type).toBe('trpc_router')
    // 路径包含 /trpc/
    expect(classifyFile('server/trpc/router.ts', meta).type).toBe('trpc_router')
  })

  it('非 trpc 项目不识别 router 文件', () => {
    const meta = withProjectMeta({ backendFramework: 'unknown' })
    expect(classifyFile('server/routers/user.ts', meta).type).toBe('unknown')
  })

  // ─── Express Route ───
  it('识别 express route 文件', () => {
    const meta = withProjectMeta({ backendFramework: 'express' })
    expect(classifyFile('server/routes/users.ts', meta).type).toBe('express_route')
    expect(classifyFile('server/routes.ts', meta).type).toBe('express_route')
  })

  it('非 express 项目不识别 routes 文件', () => {
    const meta = withProjectMeta({ backendFramework: 'unknown' })
    expect(classifyFile('server/routes/users.ts', meta).type).toBe('unknown')
  })

  // ─── TypeORM Entity ───
  it('识别 typeorm entity 文件', () => {
    const meta = withProjectMeta({ databaseType: 'typeorm' })
    expect(classifyFile('src/entity/User.ts', meta).type).toBe('typeorm_entity')
    expect(classifyFile('src/entities/User.ts', meta).type).toBe('typeorm_entity')
  })

  it('非 typeorm 项目不识别 entity 文件', () => {
    const meta = withProjectMeta({ databaseType: 'unknown' })
    expect(classifyFile('src/entity/User.ts', meta).type).toBe('unknown')
  })

  // ─── React Component ───
  it('默认识别 tsx/jsx 为 react component', () => {
    expect(classifyFile('components/Button.tsx', baseMeta).type).toBe('react_component')
    expect(classifyFile('components/Card.jsx', baseMeta).type).toBe('react_component')
  })

  // ─── Unknown ───
  it('无法识别的文件返回 unknown', () => {
    expect(classifyFile('utils/helper.ts', baseMeta).type).toBe('unknown')
    expect(classifyFile('README.md', baseMeta).type).toBe('unknown')
  })

  // ─── Windows 路径 ───
  it('处理 Windows 反斜杠路径', () => {
    expect(classifyFile('app\\page.tsx', baseMeta).type).toBe('nextjs_page')
    expect(classifyFile('app\\api\\route.ts', baseMeta).type).toBe('nextjs_api_route')
  })
})
