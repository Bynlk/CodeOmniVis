/**
 * RoomParser 测试
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { RoomParser } from '../../../src/parsers/kotlin/roomParser'
import type { ProjectMeta, ParseContext } from '@codeomnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/kotlin')

const roomProjectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
  frontendFramework: 'unknown',
  backendFramework: 'unknown',
  databaseType: 'room',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: [],
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

const roomContext: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta: roomProjectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('RoomParser', () => {
  const parser = new RoomParser()

  describe('canHandle', () => {
    it('should handle .kt files when database is room', () => {
      expect(parser.canHandle('src/main/Entity.kt', roomProjectMeta)).toBe(true)
    })

    it('should not handle when database is not room', () => {
      const meta: ProjectMeta = { ...roomProjectMeta, databaseType: 'unknown' }
      expect(parser.canHandle('src/main/Entity.kt', meta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse Room @Entity classes as db_model nodes', async () => {
      const result = await parser.parse('room-entity.kt', roomContext)

      expect(result.errors).toHaveLength(0)

      const dbModels = result.nodes.filter(n => n.type === 'db_model')
      expect(dbModels.length).toBeGreaterThanOrEqual(1)
      expect(dbModels.some(n => n.name === 'User')).toBe(true)
    })

    it('should parse Room @Dao interfaces', async () => {
      const result = await parser.parse('room-entity.kt', roomContext)

      const interfaces = result.nodes.filter(n => n.type === 'kotlin_interface')
      expect(interfaces.length).toBeGreaterThanOrEqual(1)
      expect(interfaces.some(n => n.name === 'UserDao')).toBe(true)
    })
  })
})
