/**
 * Express 路由解析器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { ExpressParser } from '../../src/parsers/express'
import { isNodeOfType, type ParseContext, type ProjectMeta } from '@codeomnivis/shared'

const projectRoot = path.resolve(__dirname, '../fixtures/express-contract')
const expressMeta: ProjectMeta = {
  root: projectRoot,
  frontendFramework: 'unknown',
  backendFramework: 'express',
  databaseType: 'unknown',
  monorepoType: 'none',
  frontendDirs: [],
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
  projectMeta: expressMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('ExpressParser', () => {
  let parser: ExpressParser

  beforeEach(() => {
    parser = new ExpressParser()
  })

  describe('canHandle', () => {
    it('匹配 routes/ 目录下的文件', () => {
      expect(parser.canHandle('server/routes/users.ts', expressMeta)).toBe(true)
      expect(parser.canHandle('server/routes/booking.ts', expressMeta)).toBe(true)
    })

    it('匹配 routes.ts/router.ts 文件', () => {
      expect(parser.canHandle('server/routes.ts', expressMeta)).toBe(true)
      expect(parser.canHandle('server/router.ts', expressMeta)).toBe(true)
    })

    it('排除测试文件', () => {
      expect(parser.canHandle('server/routes/__tests__/users.test.ts', expressMeta)).toBe(false)
      expect(parser.canHandle('server/routes/users.test.ts', expressMeta)).toBe(false)
    })

    it('非 express 项目返回 false', () => {
      const meta: ProjectMeta = { ...expressMeta, backendFramework: 'unknown' }
      expect(parser.canHandle('server/routes/users.ts', meta)).toBe(false)
    })

    it('非 routes 目录返回 false', () => {
      expect(parser.canHandle('server/controllers/users.ts', expressMeta)).toBe(false)
    })

    it('处理 Windows 路径', () => {
      expect(parser.canHandle('server\\routes\\users.ts', expressMeta)).toBe(true)
    })
  })

  describe('parse', () => {
    it('extracts app and router routes with the router prefix', async () => {
      const result = await parser.parse('src/routes/orders.ts', context)

      expect(result.errors).toEqual([])
      expect(result.nodes.filter(node => isNodeOfType(node, 'api_route')).map(node => ({
        name: node.name,
        method: node.metadata.method,
      }))).toEqual([
        { name: '/v1', method: 'GET' },
        { name: '/v1/orders', method: 'POST' },
        { name: '/health', method: 'PATCH' },
      ])
    })

    it('degrades a missing route file to a warning', async () => {
      const result = await parser.parse('src/routes/missing.ts', context)
      expect(result.nodes).toEqual([])
      expect(result.errors).toEqual([
        expect.objectContaining({ severity: 'warning', message: expect.stringContaining('Express parser failed') }),
      ])
    })

    it('ignores calls without static paths or supported methods', async () => {
      const result = await parser.parse('src/routes/empty.ts', context)
      expect(result).toEqual({ nodes: [], edges: [], errors: [] })
    })
  })
})
