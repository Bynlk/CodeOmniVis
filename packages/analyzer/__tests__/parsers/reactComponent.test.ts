/**
 * React 组件解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { ReactComponentParser } from '../../src/parsers/reactComponent'
import type { ParseContext, ProjectMeta } from '@omnivis/shared'

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

describe('ReactComponentParser', () => {
  let parser: ReactComponentParser

  beforeEach(() => {
    parser = new ReactComponentParser()
  })

  describe('canHandle', () => {
    it('should handle .tsx files', () => {
      expect(parser.canHandle('components/BookingPage.tsx', projectMeta)).toBe(true)
    })

    it('should handle .jsx files', () => {
      expect(parser.canHandle('components/Button.jsx', projectMeta)).toBe(true)
    })

    it('should not handle .ts files', () => {
      expect(parser.canHandle('utils/api.ts', projectMeta)).toBe(false)
    })

    it('should not handle test files', () => {
      expect(parser.canHandle('__tests__/BookingPage.test.tsx', projectMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should extract component', async () => {
      const result = await parser.parse('components/BookingPage.tsx', context)

      expect(result.nodes.length).toBeGreaterThanOrEqual(1)
      expect(result.nodes[0].type).toBe('component')
      expect(result.nodes[0].name).toBe('BookingPage')
    })

    it('should extract renders edges', async () => {
      const result = await parser.parse('components/BookingPage.tsx', context)

      const rendersEdges = result.edges.filter(e => e.type === 'renders')
      expect(rendersEdges.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle non-existent file gracefully', async () => {
      const result = await parser.parse('components/NonExistent.tsx', context)

      expect(result.nodes).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
