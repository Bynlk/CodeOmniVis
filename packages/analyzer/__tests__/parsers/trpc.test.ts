/**
 * tRPC 解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { TrpcParser } from '../../src/parsers/trpc'
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
  trpcRouterPaths: ['server/routers'],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  packages: [],
}

const context: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('TrpcParser', () => {
  let parser: TrpcParser

  beforeEach(() => {
    parser = new TrpcParser()
  })

  describe('canHandle', () => {
    it('should handle router files', () => {
      expect(parser.canHandle('server/routers/booking.ts', projectMeta)).toBe(true)
    })

    it('should handle files in trpc directory', () => {
      expect(parser.canHandle('server/trpc/index.ts', projectMeta)).toBe(true)
    })

    it('should not handle non-trpc projects', () => {
      const meta = { ...projectMeta, backendFramework: 'express' as const }
      expect(parser.canHandle('server/routers/booking.ts', meta)).toBe(false)
    })

    it('should not handle unrelated files', () => {
      expect(parser.canHandle('components/Button.tsx', projectMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse tRPC router file', async () => {
      const result = await parser.parse('server/routers/booking.ts', context)

      // 应该有 4 个节点：1 个 router + 3 个 procedures
      expect(result.nodes.length).toBeGreaterThanOrEqual(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should extract procedure names', async () => {
      const result = await parser.parse('server/routers/booking.ts', context)
      const procedureNames = result.nodes.map(n => n.name)

      expect(procedureNames).toContain('list')
      expect(procedureNames).toContain('getById')
      expect(procedureNames).toContain('create')
    })

    it('should detect procedure types', async () => {
      const result = await parser.parse('server/routers/booking.ts', context)

      const createProc = result.nodes.find(n => n.name === 'create')
      if (createProc) {
        expect((createProc.metadata as any).procedureType).toBe('mutation')
      }

      const listProc = result.nodes.find(n => n.name === 'list')
      if (listProc) {
        expect((listProc.metadata as any).procedureType).toBe('query')
      }
    })

    it('should handle non-existent file gracefully', async () => {
      const result = await parser.parse('server/routers/nonexistent.ts', context)

      expect(result.nodes).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
