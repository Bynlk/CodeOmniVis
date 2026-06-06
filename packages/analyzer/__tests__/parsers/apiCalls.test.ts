/**
 * API 调用解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { ApiCallsParser } from '../../src/parsers/apiCalls'
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

describe('ApiCallsParser', () => {
  let parser: ApiCallsParser

  beforeEach(() => {
    parser = new ApiCallsParser()
  })

  describe('canHandle', () => {
    it('should handle .tsx files', () => {
      expect(parser.canHandle('components/BookingList.tsx', projectMeta)).toBe(true)
    })

    it('should handle .ts files', () => {
      expect(parser.canHandle('utils/api.ts', projectMeta)).toBe(true)
    })

    it('should not handle test files', () => {
      expect(parser.canHandle('__tests__/BookingList.test.tsx', projectMeta)).toBe(false)
    })

    it('should not handle non-js files', () => {
      expect(parser.canHandle('styles/main.css', projectMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should detect fetch calls', async () => {
      const result = await parser.parse('components/BookingList.tsx', context)

      const fetchEdge = result.edges.find(e =>
        (e.metadata as any).callType === 'fetch'
      )

      expect(fetchEdge).toBeDefined()
      expect(fetchEdge?.confidence).toBe('certain')
    })

    it('should detect tRPC hooks', async () => {
      const result = await parser.parse('components/BookingList.tsx', context)

      const trpcEdge = result.edges.find(e =>
        (e.metadata as any).callType === 'trpc_hook'
      )

      expect(trpcEdge).toBeDefined()
      expect(trpcEdge?.confidence).toBe('certain')
    })

    it('should extract HTTP methods', async () => {
      const result = await parser.parse('components/BookingList.tsx', context)

      const fetchEdge = result.edges.find(e =>
        (e.metadata as any).callType === 'fetch'
      )

      expect((fetchEdge?.metadata as any).method).toBe('POST')
    })

    it('should handle non-existent file gracefully', async () => {
      const result = await parser.parse('components/NonExistent.tsx', context)

      expect(result.edges).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
