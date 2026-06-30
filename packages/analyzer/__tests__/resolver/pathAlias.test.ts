/**
 * 路径别名解析器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as os from 'os'
import * as fs from 'fs'
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

    it('resolves an @ alias to a real file via tsconfig paths', () => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-alias-'))
      try {
        fs.writeFileSync(
          path.join(tmpRoot, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
          }),
        )
        fs.mkdirSync(path.join(tmpRoot, 'src', 'components'), { recursive: true })
        const buttonFile = path.join(tmpRoot, 'src', 'components', 'Button.tsx')
        fs.writeFileSync(buttonFile, 'export const Button = () => null\n')

        const aliasResolver = new PathAliasResolver(tmpRoot)
        aliasResolver.loadConfig()
        const result = aliasResolver.resolve('@/components/Button', 'src/page.tsx')

        expect(result).not.toBeNull()
        expect(path.resolve(result ?? '')).toBe(path.resolve(buttonFile))
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true })
      }
    })

    it('returns null for an @ alias with no matching file', () => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-alias-'))
      try {
        fs.writeFileSync(
          path.join(tmpRoot, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
          }),
        )
        const aliasResolver = new PathAliasResolver(tmpRoot)
        aliasResolver.loadConfig()
        const result = aliasResolver.resolve('@/components/DoesNotExist', 'src/page.tsx')
        expect(result).toBeNull()
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true })
      }
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
