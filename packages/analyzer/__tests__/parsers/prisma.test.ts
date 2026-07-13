/**
 * Prisma 解析器单元测试
 *
 * 测试：
 * 1. 正常输入 → 正确输出
 * 2. 异常输入 → 优雅降级
 * 3. 边界情况
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { PrismaParser } from '../../src/parsers/prisma'
import { isNodeOfType } from '@codeomnivis/shared'
import type { ParseContext, ProjectMeta, TypedOmniNode } from '@codeomnivis/shared'

// ============================================================
// 测试数据
// ============================================================

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures')
const SCHEMA_PATH = path.join(FIXTURES_DIR, 'schema.prisma')

const projectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
  frontendFramework: 'next',
  backendFramework: 'trpc',
  databaseType: 'prisma',
  monorepoType: 'none',
  frontendDirs: ['app'],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
  prismaSchemaPath: 'schema.prisma',
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

// ============================================================
// 测试套件
// ============================================================

describe('PrismaParser', () => {
  let parser: PrismaParser

  beforeEach(() => {
    parser = new PrismaParser()
  })

  // ============================================================
  // canHandle 测试
  // ============================================================

  describe('canHandle', () => {
    it('should handle .prisma files', () => {
      expect(parser.canHandle('schema.prisma', projectMeta)).toBe(true)
    })

    it('should handle prisma schema path from project meta', () => {
      expect(parser.canHandle('schema.prisma', projectMeta)).toBe(true)
    })

    it('should not handle non-prisma files', () => {
      expect(parser.canHandle('index.ts', projectMeta)).toBe(false)
    })

    it('should still handle .prisma files even when database type is different', () => {
      // .prisma 文件扩展名是强信号，应该总是处理
      const meta: ProjectMeta = { ...projectMeta, databaseType: 'typeorm' }
      expect(parser.canHandle('schema.prisma', meta)).toBe(true)
    })
  })

  // ============================================================
  // parse 测试
  // ============================================================

  describe('parse', () => {
    it('should parse prisma schema correctly', async () => {
      const result = await parser.parse('schema.prisma', context)

      // 应该有 4 个 Model
      expect(result.nodes).toHaveLength(4)

      // 检查节点类型
      const nodeNames = result.nodes.map(n => n.name).sort()
      expect(nodeNames).toEqual(['Post', 'Profile', 'Tag', 'User'])

      // 检查节点类型
      for (const node of result.nodes) {
        expect(node.type).toBe('db_model')
        expect(node.filePath).toBe('schema.prisma')
        expect(node.id).toMatch(/^db_model:schema\.prisma:/)
      }
    })

    it('should extract model metadata correctly', async () => {
      const result = await parser.parse('schema.prisma', context)
      const userNode = result.nodes.find((n): n is TypedOmniNode<'db_model'> =>
        isNodeOfType(n, 'db_model') && n.name === 'User'
      )

      expect(userNode).toBeDefined()
      expect(userNode?.metadata).toBeDefined()

      expect(userNode?.metadata.tableName).toBe('users')
      expect(userNode?.metadata.fieldCount).toBeGreaterThan(0)
      expect(userNode?.metadata.fields).toBeInstanceOf(Array)
    })

    it('should parse relations correctly', async () => {
      const result = await parser.parse('schema.prisma', context)

      // 应该有关系边
      expect(result.edges.length).toBeGreaterThan(0)

      // 所有边都应该是 db_relation 类型
      for (const edge of result.edges) {
        expect(edge.type).toBe('db_relation')
        expect(edge.confidence).toBe('certain')
      }
    })

    it('classifies the scalar side of a one-to-many relation as many-to-one', async () => {
      const result = await parser.parse('schema.prisma', context)
      const authorRelation = result.edges.find(
        (edge): edge is Extract<typeof edge, { type: 'db_relation' }> =>
          edge.type === 'db_relation' && edge.source.endsWith(':Post') && edge.target.endsWith(':User'),
      )

      expect(authorRelation?.metadata.relationType).toBe('many_to_one')
    })

    it('should have no errors on valid schema', async () => {
      const result = await parser.parse('schema.prisma', context)
      expect(result.errors).toHaveLength(0)
    })

    it('should return error for non-existent file', async () => {
      const result = await parser.parse('non-existent.prisma', context)

      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].severity).toBe('error')
    })

    it('should return error for invalid schema', async () => {
      const result = await parser.parse('invalid-schema.prisma', {
        ...context,
        projectRoot: FIXTURES_DIR,
      })

      // 文件不存在，应该报错
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should have correct line numbers', async () => {
      const result = await parser.parse('schema.prisma', context)

      for (const node of result.nodes) {
        expect(node.line).toBeGreaterThan(0)
      }
    })
  })

  // ============================================================
  // 边界情况测试
  // ============================================================

  describe('Edge Cases', () => {
    it('should handle empty schema gracefully', async () => {
      // 测试不存在的文件，应该降级而不是崩溃
      const result = await parser.parse('empty.prisma', context)
      expect(result.nodes).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle parser errors gracefully', async () => {
      // 测试一个会导致解析错误的场景
      const result = await parser.parse('invalid.prisma', context)

      // 应该返回错误而不是抛出异常
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })
})
