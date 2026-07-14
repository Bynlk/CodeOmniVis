/**
 * TypeORM Entity 解析器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { TypeormParser } from '../../src/parsers/typeorm'
import { isEdgeOfType, type ParseContext, type ProjectMeta } from '@codeomnivis/shared'

const projectRoot = path.resolve(__dirname, '../fixtures/typeorm')
const typeormMeta: ProjectMeta = {
  root: projectRoot,
  frontendFramework: 'unknown',
  backendFramework: 'express',
  databaseType: 'typeorm',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
  prismaSchemaPath: null,
  typeormEntityDirs: ['src/entity'],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
}
const context: ParseContext = {
  projectRoot,
  projectMeta: typeormMeta,
  tsConfig: null,
  pathAliases: {},
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
      const meta: ProjectMeta = { ...typeormMeta, databaseType: 'unknown' }
      expect(parser.canHandle('src/entity/User.ts', meta)).toBe(false)
    })

    it('非 entity 目录返回 false', () => {
      expect(parser.canHandle('src/models/User.ts', typeormMeta)).toBe(false)
    })

    it('处理 Windows 路径', () => {
      expect(parser.canHandle('src\\entity\\User.ts', typeormMeta)).toBe(true)
    })
  })

  describe('parse', () => {
    it('extracts entity fields and all supported relation kinds', async () => {
      const result = await parser.parse('src/entity/User.ts', context)

      expect(result.errors).toEqual([])
      expect(result.nodes).toEqual([
        expect.objectContaining({
          type: 'db_model',
          name: 'User',
          metadata: expect.objectContaining({ tableName: 'users', fieldCount: 3 }),
        }),
      ])
      expect(
        result.edges
          .filter((edge) => isEdgeOfType(edge, 'db_relation'))
          .map((edge) => edge.metadata.relationType),
      ).toEqual(['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'])
    })

    it('degrades a missing entity file to a warning', async () => {
      const result = await parser.parse('src/entity/Missing.ts', context)

      expect(result.nodes).toEqual([])
      expect(result.edges).toEqual([])
      expect(result.errors).toEqual([
        expect.objectContaining({
          severity: 'warning',
          message: expect.stringContaining('TypeORM parser failed'),
        }),
      ])
    })

    it('returns an empty result for an entity file without decorated classes', async () => {
      const result = await parser.parse('src/entity/Empty.ts', context)
      expect(result).toEqual({ nodes: [], edges: [], errors: [] })
    })
  })
})
