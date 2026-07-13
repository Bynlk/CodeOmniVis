/**
 * Next.js App Router 解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { NextjsAppParser } from '../../src/parsers/nextjsApp'
import { isNodeOfType } from '@codeomnivis/shared'
import type { ParseContext, ProjectMeta } from '@codeomnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures')

const projectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
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
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
}

const context: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('NextjsAppParser', () => {
  let parser: NextjsAppParser

  beforeEach(() => {
    parser = new NextjsAppParser()
  })

  describe('canHandle', () => {
    it('should handle page.tsx in app directory', () => {
      expect(parser.canHandle('app/booking/page.tsx', projectMeta)).toBe(true)
    })

    it('should handle route.ts in app directory', () => {
      expect(parser.canHandle('app/api/booking/route.ts', projectMeta)).toBe(true)
    })

    it('should not handle non-nextjs projects', () => {
      const meta: ProjectMeta = { ...projectMeta, frontendFramework: 'unknown' }
      expect(parser.canHandle('app/booking/page.tsx', meta)).toBe(false)
    })

    it('should not handle non-app files', () => {
      expect(parser.canHandle('components/Button.tsx', projectMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('maps root page and root route files to the root URL', async () => {
      const root = path.resolve(__dirname, '../fixtures/root-route')
      const rootContext: ParseContext = { ...context, projectRoot: root, projectMeta: { ...projectMeta, root } }
      const rootParser = new NextjsAppParser()

      const page = await rootParser.parse('app/page.tsx', rootContext)
      const route = await rootParser.parse('app/route.ts', rootContext)

      expect(page.nodes[0]?.name).toBe('/')
      expect(route.nodes[0]?.name).toBe('/')
    })
    it('should parse page file correctly', async () => {
      const result = await parser.parse('app/booking/[id]/page.tsx', context)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe('page')
      expect(result.nodes[0].name).toBe('/booking/[id]')
      expect(result.errors).toHaveLength(0)
    })

    it('should parse route file correctly', async () => {
      const result = await parser.parse('app/api/booking/route.ts', context)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe('api_route')
      expect(result.nodes[0].name).toBe('/api/booking')
      expect(result.errors).toHaveLength(0)
    })

    it('should detect dynamic routes', async () => {
      const result = await parser.parse('app/booking/[id]/page.tsx', context)
      const pageNode = result.nodes[0]

      expect(isNodeOfType(pageNode, 'page')).toBe(true)
      if (!isNodeOfType(pageNode, 'page')) throw new Error('Expected page node')

      expect(pageNode.metadata.isDynamic).toBe(true)
      expect(pageNode.metadata.params).toContain('id')
    })

    it('should extract HTTP methods from route', async () => {
      const result = await parser.parse('app/api/booking/route.ts', context)
      const routeNode = result.nodes[0]

      expect(isNodeOfType(routeNode, 'api_route')).toBe(true)
      if (!isNodeOfType(routeNode, 'api_route')) throw new Error('Expected API route node')

      expect(routeNode.metadata.method).toContain('GET')
      expect(routeNode.metadata.method).toContain('POST')
    })

    it('should handle non-existent file gracefully', async () => {
      const result = await parser.parse('app/nonexistent/page.tsx', context)

      // 文件不存在时应该返回空节点
      expect(result.nodes).toHaveLength(0)
    })
  })
})
