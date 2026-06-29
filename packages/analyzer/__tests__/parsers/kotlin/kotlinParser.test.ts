/**
 * KotlinParser 测试
 */

import { describe, it, expect } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import { KotlinParser } from '../../../src/parsers/kotlin/kotlinParser'
import { isNodeOfType } from '@codeomnivis/shared'
import type { ProjectMeta, ParseContext } from '@codeomnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/kotlin')

const mockProjectMeta: ProjectMeta = {
  root: FIXTURES_DIR,
  frontendFramework: 'unknown',
  backendFramework: 'unknown',
  databaseType: 'unknown',
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

const mockContext: ParseContext = {
  projectRoot: FIXTURES_DIR,
  projectMeta: mockProjectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('KotlinParser', () => {
  const parser = new KotlinParser()

  describe('canHandle', () => {
    it('should handle .kt files', () => {
      expect(parser.canHandle('src/main/Main.kt', mockProjectMeta)).toBe(true)
    })

    it('should not handle test files', () => {
      expect(parser.canHandle('src/test/MainTest.kt', mockProjectMeta)).toBe(false)
    })

    it('should not handle non-.kt files', () => {
      expect(parser.canHandle('src/main/Main.java', mockProjectMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse classes from spring-controller.kt', async () => {
      const result = await parser.parse('spring-controller.kt', mockContext)

      expect(result.errors).toHaveLength(0)
      expect(result.nodes.length).toBeGreaterThan(0)

      const classes = result.nodes.filter(n => n.type === 'kotlin_class')
      expect(classes.length).toBeGreaterThanOrEqual(1)

      const classNames = classes.map(n => n.name)
      expect(classNames).toContain('UserController')
    })

    it('should parse data class from spring-controller.kt', async () => {
      const result = await parser.parse('spring-controller.kt', mockContext)

      const dataClass = result.nodes.find(n =>
        n.type === 'kotlin_class' && n.name === 'User'
      )
      expect(dataClass).toBeDefined()
      if (!dataClass) throw new Error('Expected User data class')

      expect(isNodeOfType(dataClass, 'kotlin_class')).toBe(true)
      if (!isNodeOfType(dataClass, 'kotlin_class')) throw new Error('Expected Kotlin class node')

      expect(dataClass.metadata.kind).toBe('data')
      expect(dataClass.metadata.packageName).toBe('com.example.demo.controller')
    })

    it('should parse classes from ktor-routing.kt', async () => {
      const result = await parser.parse('ktor-routing.kt', mockContext)

      expect(result.errors).toHaveLength(0)
      const classes = result.nodes.filter(n => n.type === 'kotlin_class')
      expect(classes.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle invalid file gracefully', async () => {
      const result = await parser.parse('nonexistent.kt', mockContext)

      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].severity).toBe('warning')
    })
  })
})
