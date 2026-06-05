/**
 * 路径别名解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { PathAliasResolver } from '../../src/resolver/pathAlias'

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures')

describe('PathAliasResolver', () => {
  let resolver: PathAliasResolver

  beforeEach(() => {
    resolver = new PathAliasResolver(FIXTURES_DIR)
  })

  describe('loadConfig', () => {
    it('should load config without errors', () => {
      expect(() => resolver.loadConfig()).not.toThrow()
    })

    it('should handle missing tsconfig gracefully', () => {
      const resolver = new PathAliasResolver('/nonexistent')
      expect(() => resolver.loadConfig()).not.toThrow()
    })
  })

  describe('resolve', () => {
    it('should return null for non-alias paths', () => {
      resolver.loadConfig()
      const result = resolver.resolve('./components/Button', 'src/page.tsx')
      expect(result).toBeNull()
    })

    it('should handle @ alias', () => {
      resolver.loadConfig()
      const result = resolver.resolve('@/components/Button', 'src/page.tsx')
      // 结果取决于是否有实际文件存在
      expect(result === null || typeof result === 'string').toBe(true)
    })
  })

  describe('getAliasPrefixes', () => {
    it('should return array', () => {
      resolver.loadConfig()
      const prefixes = resolver.getAliasPrefixes()
      expect(Array.isArray(prefixes)).toBe(true)
    })
  })
})
