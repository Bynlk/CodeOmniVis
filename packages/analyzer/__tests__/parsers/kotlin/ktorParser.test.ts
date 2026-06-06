/**
 * KtorParser 测试
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { KtorParser } from '../../../src/parsers/kotlin/ktorParser'
import type { ProjectMeta, ParseContext } from '@omnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/kotlin')

const ktorProjectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
  frontendFramework: 'unknown',
  backendFramework: 'ktor',
  databaseType: 'unknown',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: [],
  trpcRouterPaths: [],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
}

const ktorContext: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta: ktorProjectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('KtorParser', () => {
  const parser = new KtorParser()

  describe('canHandle', () => {
    it('should handle .kt files when backend is ktor', () => {
      expect(parser.canHandle('src/main/Routing.kt', ktorProjectMeta)).toBe(true)
    })

    it('should not handle when backend is not ktor', () => {
      const meta = { ...ktorProjectMeta, backendFramework: 'unknown' as const }
      expect(parser.canHandle('src/main/Routing.kt', meta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse Ktor routing DSL routes', async () => {
      const result = await parser.parse('ktor-routing.kt', ktorContext)

      expect(result.errors).toHaveLength(0)

      const routes = result.nodes.filter(n => n.type === 'kotlin_route')
      expect(routes.length).toBeGreaterThanOrEqual(3) // get, post, delete

      const methods = routes.map(n => (n.metadata as any).method)
      expect(methods).toContain('GET')
      expect(methods).toContain('POST')
      expect(methods).toContain('DELETE')
    })

    it('should extract route paths', async () => {
      const result = await parser.parse('ktor-routing.kt', ktorContext)

      const routes = result.nodes.filter(n => n.type === 'kotlin_route')
      const paths = routes.map(n => (n.metadata as any).path)
      expect(paths).toContain('/api/users')
    })
  })
})
