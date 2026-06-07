/**
 * SpringKotlinParser 测试
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { SpringKotlinParser } from '../../../src/parsers/kotlin/springKotlinParser'
import type { ProjectMeta, ParseContext, KotlinRouteMetadata } from '@codeomnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/kotlin')

const springProjectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
  frontendFramework: 'unknown',
  backendFramework: 'spring',
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

const springContext: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta: springProjectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('SpringKotlinParser', () => {
  const parser = new SpringKotlinParser()

  describe('canHandle', () => {
    it('should handle .kt files when backend is spring', () => {
      expect(parser.canHandle('src/main/Controller.kt', springProjectMeta)).toBe(true)
    })

    it('should not handle when backend is not spring', () => {
      const meta = { ...springProjectMeta, backendFramework: 'unknown' as const }
      expect(parser.canHandle('src/main/Controller.kt', meta)).toBe(false)
    })

    it('should not handle test files', () => {
      expect(parser.canHandle('src/test/ControllerTest.kt', springProjectMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse Spring controller routes', async () => {
      const result = await parser.parse('spring-controller.kt', springContext)

      expect(result.errors).toHaveLength(0)

      const routes = result.nodes.filter(n => n.type === 'kotlin_route')
      expect(routes.length).toBeGreaterThanOrEqual(3) // GET, POST, DELETE

      const methods = routes.map(n => (n.metadata as KotlinRouteMetadata).method)
      expect(methods).toContain('GET')
      expect(methods).toContain('POST')
      expect(methods).toContain('DELETE')
    })

    it('should create handles edges from routes to functions', async () => {
      const result = await parser.parse('spring-controller.kt', springContext)

      const handlesEdges = result.edges.filter(e => e.type === 'handles')
      expect(handlesEdges.length).toBeGreaterThan(0)
    })

    it('should not run on non-spring projects', async () => {
      const nonSpringContext = {
        ...springContext,
        projectMeta: { ...springProjectMeta, backendFramework: 'unknown' as const },
      }
      const result = await parser.parse('spring-controller.kt', nonSpringContext)

      // canHandle returns false, but parse still works (pipeline checks canHandle)
      // The parser should produce no results since it's designed for Spring
      expect(result.nodes).toHaveLength(0)
    })
  })
})
