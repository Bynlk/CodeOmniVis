/**
 * tRPC 解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { TrpcParser } from '../../src/parsers/trpc'
import { isNodeOfType } from '@codeomnivis/shared'
import type { ParseContext, ProjectMeta, TypedOmniNode } from '@codeomnivis/shared'

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
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
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
      const meta: ProjectMeta = { ...projectMeta, backendFramework: 'express' }
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

      const createProc = result.nodes.find((n): n is TypedOmniNode<'trpc_procedure'> =>
        isNodeOfType(n, 'trpc_procedure') && n.name === 'create'
      )
      expect(createProc?.metadata.procedureType).toBe('mutation')

      const listProc = result.nodes.find((n): n is TypedOmniNode<'trpc_procedure'> =>
        isNodeOfType(n, 'trpc_procedure') && n.name === 'list'
      )
      expect(listProc?.metadata.procedureType).toBe('query')
    })

    it('detects chained input and output schemas', async () => {
      const booking = await parser.parse('server/routers/booking.ts', context)
      const metadata = (name: string) => booking.nodes.find((node): node is TypedOmniNode<'trpc_procedure'> =>
        isNodeOfType(node, 'trpc_procedure') && node.name === name
      )?.metadata

      expect(metadata('list')?.hasInput).toBe(false)
      expect(metadata('getById')?.hasInput).toBe(true)
      expect(metadata('create')?.hasInput).toBe(true)

      const output = await parser.parse('server/routers/output.ts', context)
      const health = output.nodes.find((node): node is TypedOmniNode<'trpc_procedure'> =>
        isNodeOfType(node, 'trpc_procedure') && node.name === 'health'
      )
      expect(health?.metadata.hasOutput).toBe(true)
    })

    it('propagates the normalized router key to every child procedure', async () => {
      const result = await parser.parse('server/routers/booking.ts', context)
      const procedures = result.nodes.filter((node): node is TypedOmniNode<'trpc_procedure'> =>
        isNodeOfType(node, 'trpc_procedure') && ['list', 'getById', 'create'].includes(node.name)
      )

      expect(procedures).toHaveLength(3)
      expect(procedures.map(node => node.metadata.routerName)).toEqual([
        'booking',
        'booking',
        'booking',
      ])
    })

    it('distinguishes the router declaration from executable procedures', async () => {
      const result = await parser.parse('server/routers/booking.ts', context)
      const router = result.nodes.find(node => node.name === 'bookingRouter')
      const procedures = result.nodes.filter(node =>
        ['list', 'getById', 'create'].includes(node.name)
      )

      expect(router && 'isRouter' in router.metadata && router.metadata.isRouter).toBe(true)
      expect(procedures.every(node => !('isRouter' in node.metadata) || !node.metadata.isRouter))
        .toBe(true)
    })

    it('should handle non-existent file gracefully', async () => {
      const result = await parser.parse('server/routers/nonexistent.ts', context)

      expect(result.nodes).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
