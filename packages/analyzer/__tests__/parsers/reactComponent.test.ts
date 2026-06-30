/**
 * React 组件解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { ReactComponentParser } from '../../src/parsers/reactComponent'
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
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
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

    // H6 · BOUND-03: export const X = () => {} 箭头函数组件必须被识别为导出。
    it('recognizes an exported arrow-function component', async () => {
      const result = await parser.parse('components/ArrowCard.tsx', context)
      const names = result.nodes.filter(n => n.type === 'component').map(n => n.name)
      expect(names).toContain('ArrowCard')
    })

    it('does not treat a non-exported const component as exported', async () => {
      const result = await parser.parse('components/ArrowCard.tsx', context)
      const names = result.nodes.filter(n => n.type === 'component').map(n => n.name)
      expect(names).not.toContain('InternalWidget')
    })

    it('does not misclassify a lowercase exported const as a component', async () => {
      const result = await parser.parse('components/ArrowCard.tsx', context)
      const names = result.nodes.filter(n => n.type === 'component').map(n => n.name)
      expect(names).not.toContain('helperValue')
    })
  })
})
