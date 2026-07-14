/**
 * collectScanDirs sibling boundary 测试 (S-08/F4)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { collectAnalysisFiles } from '../../src/graph/collectAnalysisFiles'
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
    const files = collectAnalysisFiles(root, makeMeta(root, 'none'))
    expect(files.some((file) => file.includes('frontend'))).toBe(false)
  })

  it('仅显式 metadata 才纳入兄弟 frontend 目录', () => {
    const meta = makeMeta(root, 'turborepo')
    meta.frontendDirs = [path.join(sibling, 'src')]
    const files = collectAnalysisFiles(root, meta)
    expect(files).toHaveLength(2)
  })
})
