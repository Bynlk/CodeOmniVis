/**
 * Next.js Pages Router 解析器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NextjsPagesParser } from '../../src/parsers/nextjsPages'
import type { ProjectMeta } from '@codeomnivis/shared'

const projectMeta: ProjectMeta = {
  root: '/project',
  frontendFramework: 'next',
  backendFramework: 'trpc',
  databaseType: 'prisma',
  monorepoType: 'none',
  frontendDirs: ['pages'],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
    buildFile: null,
  packages: [],
}

describe('NextjsPagesParser', () => {
  let parser: NextjsPagesParser

  beforeEach(() => {
    parser = new NextjsPagesParser()
  })

  describe('canHandle', () => {
    it('匹配 pages/ 下的 tsx 文件', () => {
      expect(parser.canHandle('pages/index.tsx', projectMeta)).toBe(true)
      expect(parser.canHandle('pages/about.tsx', projectMeta)).toBe(true)
      expect(parser.canHandle('pages/booking/[id].tsx', projectMeta)).toBe(true)
    })

    it('匹配 pages/ 下的 ts 文件', () => {
      expect(parser.canHandle('pages/about.ts', projectMeta)).toBe(true)
    })

    it('排除 _app/_document/_error', () => {
      expect(parser.canHandle('pages/_app.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('pages/_document.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('pages/_error.tsx', projectMeta)).toBe(false)
    })

    it('排除测试文件', () => {
      expect(parser.canHandle('pages/__tests__/about.test.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('pages/about.test.tsx', projectMeta)).toBe(false)
    })

    it('非 next 项目返回 false', () => {
      const meta = { ...projectMeta, frontendFramework: 'unknown' as const }
      expect(parser.canHandle('pages/index.tsx', meta)).toBe(false)
    })

    it('非 pages 目录返回 false', () => {
      expect(parser.canHandle('app/page.tsx', projectMeta)).toBe(false)
      expect(parser.canHandle('components/Button.tsx', projectMeta)).toBe(false)
    })

    it('处理 Windows 路径', () => {
      expect(parser.canHandle('pages\\index.tsx', projectMeta)).toBe(true)
    })
  })
})
