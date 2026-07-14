/**
 * Next.js Pages Router 解析器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { NextjsPagesParser } from '../../src/parsers/nextjsPages'
import type { ParseContext, ProjectMeta } from '@codeomnivis/shared'

const projectRoot = path.resolve(__dirname, '../fixtures/nextjs-pages')
const projectMeta: ProjectMeta = {
  root: projectRoot,
  frontendFramework: 'next',
  backendFramework: 'trpc',
  databaseType: 'prisma',
  monorepoType: 'none',
  frontendDirs: ['pages'],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
}
const context: ParseContext = {
  projectRoot,
  projectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('NextjsPagesParser', () => {
  let parser: NextjsPagesParser

  beforeEach(() => {
    parser = new NextjsPagesParser()
  })

  describe('canHandle', () => {
    it('匹配 pages/ 下的 tsx 文件', () => {
      expect(parser.canHandle('pages/index.tsx', projectMeta)).toBe(true)
      expect(parser.canHandle('pages/about.tsx', projectMeta)).toBe(true)
      expect(parser.canHandle('pages/booking/[id].tsx', projectMeta)).toBe(true)
    })

    it('匹配 pages/ 下的 ts 文件', () => {
      expect(parser.canHandle('pages/about.ts', projectMeta)).toBe(true)
    })

    it('排除 _app/_document/_error', () => {
      expect(parser.canHandle('pages/_app.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('pages/_document.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('pages/_error.tsx', projectMeta)).toBe(false)
    })

    it('排除测试文件', () => {
      expect(parser.canHandle('pages/__tests__/about.test.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('pages/about.test.tsx', projectMeta)).toBe(false)
    })

    it('非 next 项目返回 false', () => {
      const meta: ProjectMeta = { ...projectMeta, frontendFramework: 'unknown' }
      expect(parser.canHandle('pages/index.tsx', meta)).toBe(false)
    })

    it('非 pages 目录返回 false', () => {
      expect(parser.canHandle('app/page.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('components/Button.tsx', projectMeta)).toBe(false)
    })

    it('处理 Windows 路径', () => {
      expect(parser.canHandle('pages\\index.tsx', projectMeta)).toBe(true)
    })
  })

  describe('parse', () => {
    it('maps index and catch-all pages to stable routes and parameters', async () => {
      const index = await parser.parse('pages/index.tsx', context)
      const article = await parser.parse('pages/articles/[...slug].tsx', context)

      expect(index.nodes).toEqual([expect.objectContaining({ type: 'page', name: '/', line: 2 })])
      expect(article.nodes).toEqual([
        expect.objectContaining({
          type: 'page',
          name: '/articles/[...slug]',
          metadata: expect.objectContaining({ isDynamic: true, params: ['slug'] }),
        }),
      ])
    })

    it('extracts explicit and req.method API route methods', async () => {
      const explicit = await parser.parse('pages/api/orders.ts', context)
      const defaultHandler = await parser.parse('pages/api/users.ts', context)

      expect(explicit.nodes[0]).toEqual(expect.objectContaining({
        type: 'api_route',
        name: '/api/orders',
        metadata: expect.objectContaining({ method: 'GET,POST' }),
      }))
      expect(defaultHandler.nodes[0]).toEqual(expect.objectContaining({
        type: 'api_route',
        name: '/api/users',
        metadata: expect.objectContaining({ method: 'POST,DELETE' }),
      }))
    })

    it('degrades a missing page to a warning', async () => {
      const result = await parser.parse('pages/missing.tsx', context)
      expect(result.nodes).toEqual([])
      expect(result.errors).toEqual([
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('File not found') }),
      ])
    })
  })
})
