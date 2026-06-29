/**
 * ExposedParser 测试
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { ExposedParser } from '../../../src/parsers/kotlin/exposedParser'
import type { ProjectMeta, ParseContext } from '@codeomnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/kotlin')

const exposedProjectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
  frontendFramework: 'unknown',
  backendFramework: 'unknown',
  databaseType: 'exposed',
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

const exposedContext: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta: exposedProjectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('ExposedParser', () => {
  const parser = new ExposedParser()

  describe('canHandle', () => {
    it('should handle .kt files when database is exposed', () => {
      expect(parser.canHandle('src/main/Tables.kt', exposedProjectMeta)).toBe(true)
    })

    it('should not handle when database is not exposed', () => {
      const meta: ProjectMeta = { ...exposedProjectMeta, databaseType: 'unknown' }
      expect(parser.canHandle('src/main/Tables.kt', meta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse Exposed table objects as db_model nodes', async () => {
      const result = await parser.parse('exposed-table.kt', exposedContext)

      expect(result.errors).toHaveLength(0)

      const dbModels = result.nodes.filter(n => n.type === 'db_model')
      expect(dbModels.length).toBeGreaterThanOrEqual(2) // Users, Posts
    })

    it('should parse Exposed entity classes as db_model nodes', async () => {
      const result = await parser.parse('exposed-table.kt', exposedContext)

      const dbModels = result.nodes.filter(n => n.type === 'db_model')
      const names = dbModels.map(n => n.name)
      expect(names).toContain('User')
      expect(names).toContain('Post')
    })
  })
})
