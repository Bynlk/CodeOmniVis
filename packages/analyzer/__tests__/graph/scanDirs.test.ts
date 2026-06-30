/**
 * collectScanDirs sibling boundary 测试 (S-08/F4)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { collectScanDirs } from '../../src/graph/runFullAnalysis'
import type { ProjectMeta } from '@codeomnivis/shared'

function makeMeta(root: string, monorepoType: 'turborepo' | 'pnpm' | 'none'): ProjectMeta {
  return {
    root,
    frontendFramework: 'unknown',
    backendFramework: 'unknown',
    databaseType: 'unknown',
    monorepoType,
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
}

describe('collectScanDirs sibling boundary (S-08/F4)', () => {
  let base: string
  let root: string
  let sibling: string

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-anlz-scan-'))
    root = path.join(base, 'backend')
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export {}')
    sibling = path.join(base, 'frontend')
    fs.mkdirSync(path.join(sibling, 'src'), { recursive: true })
    fs.writeFileSync(path.join(sibling, 'src', 'app.tsx'), 'export {}')
  })

  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true })
  })

  it('monorepoType=none 时不扫描越界的兄弟目录', () => {
    const dirs = collectScanDirs(root, makeMeta(root, 'none'))
    expect(dirs.some(d => path.resolve(d).startsWith(path.resolve(sibling)))).toBe(false)
    const resolvedRoot = path.resolve(root)
    for (const d of dirs) {
      const rel = path.relative(resolvedRoot, path.resolve(d))
      expect(rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))).toBe(true)
    }
  })

  it('显式确认 monorepo 时才纳入兄弟 frontend 目录', () => {
    const dirs = collectScanDirs(root, makeMeta(root, 'turborepo'))
    expect(dirs.some(d => path.resolve(d) === path.resolve(sibling, 'src'))).toBe(true)
  })
})
