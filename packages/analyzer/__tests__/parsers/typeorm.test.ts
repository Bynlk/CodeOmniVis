/**
 * TypeORM Entity 解析器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TypeormParser } from '../../src/parsers/typeorm'
import type { ProjectMeta } from '@omnivis/shared'

const typeormMeta: ProjectMeta = {
  root: '/project',
  frontendFramework: 'unknown',
  backendFramework: 'express',
  databaseType: 'typeorm',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  prismaSchemaPath: null,
  typeormEntityDirs: ['src/entity'],
  tsConfigPath: null,
    buildFile: null,
  packages: [],
}

describe('TypeormParser', () => {
  let parser: TypeormParser

  beforeEach(() => {
    parser = new TypeormParser()
  })

  describe('canHandle', () => {
    it('匹配 entity/ 目录下的 ts 文件', () => {
      expect(parser.canHandle('src/entity/User.ts', typeormMeta)).toBe(true)
      expect(parser.canHandle('src/entities/User.ts', typeormMeta)).toBe(true)
    })

    it('匹配 .entity.ts 文件', () => {
      expect(parser.canHandle('src/models/user.entity.ts', typeormMeta)).toBe(true)
    })

    it('排除测试文件', () => {
      expect(parser.canHandle('src/entity/__tests__/User.test.ts', typeormMeta)).toBe(false)
      expect(parser.canHandle('src/entity/User.test.ts', typeormMeta)).toBe(false)
    })

    it('排除非 ts 文件', () => {
      expect(parser.canHandle('src/entity/User.js', typeormMeta)).toBe(false)
      expect(parser.canHandle('src/entity/User.json', typeormMeta)).toBe(false)
    })

    it('非 typeorm 项目返回 false', () => {
      const meta = { ...typeormMeta, databaseType: 'unknown' as const }
      expect(parser.canHandle('src/entity/User.ts', meta)).toBe(false)
    })

    it('非 entity 目录返回 false', () => {
      expect(parser.canHandle('src/models/User.ts', typeormMeta)).toBe(false)
    })

    it('处理 Windows 路径', () => {
      expect(parser.canHandle('src\\entity\\User.ts', typeormMeta)).toBe(true)
    })
  })
})
