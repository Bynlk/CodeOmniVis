/**
 * Express 路由解析器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ExpressParser } from '../../src/parsers/express'
import type { ProjectMeta } from '@codeomnivis/shared'

const expressMeta: ProjectMeta = {
  root: '/project',
  frontendFramework: 'unknown',
  backendFramework: 'express',
  databaseType: 'unknown',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
    buildFile: null,
  packages: [],
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
      const meta = { ...expressMeta, backendFramework: 'unknown' as const }
      expect(parser.canHandle('server/routes/users.ts', meta)).toBe(false)
    })

    it('非 routes 目录返回 false', () => {
      expect(parser.canHandle('server/controllers/users.ts', expressMeta)).toBe(false)
    })

    it('处理 Windows 路径', () => {
      expect(parser.canHandle('server\\routes\\users.ts', expressMeta)).toBe(true)
    })
  })
})
