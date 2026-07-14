import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ProjectMeta } from '@codeomnivis/shared'
import { collectAnalysisFiles, collectSourceFiles } from '../../src/graph/collectAnalysisFiles'

function makeMeta(root: string): ProjectMeta {
  return {
    root,
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
}

describe('collectAnalysisFiles', () => {
  const cleanupPaths: string[] = []

  afterEach(() => {
    for (const cleanupPath of cleanupPaths.splice(0)) {
      fs.rmSync(cleanupPath, { recursive: true, force: true })
    }
  })

  it('deduplicates overlapping and symlinked source directories by real file path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analysis-files-'))
    cleanupPaths.push(root)
    const source = path.join(root, 'src', 'shared')
    fs.mkdirSync(source, { recursive: true })
    fs.writeFileSync(path.join(source, 'service.ts'), 'export const service = true')
    fs.symlinkSync(source, path.join(root, 'linked'), 'dir')
    const meta = makeMeta(root)
    meta.frontendDirs = ['src', 'src/shared', path.join(root, 'linked')]

    expect(collectAnalysisFiles(root, meta)).toEqual(['src/shared/service.ts'])
  })

  it('supports an explicitly supplied sibling source directory', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analysis-sibling-'))
    cleanupPaths.push(base)
    const root = path.join(base, 'project')
    const sibling = path.join(base, 'frontend', 'src')
    fs.mkdirSync(root)
    fs.mkdirSync(sibling, { recursive: true })
    fs.writeFileSync(path.join(sibling, 'App.tsx'), 'export function App() { return null }')
    const meta = makeMeta(root)
    meta.frontendDirs = [sibling]

    expect(collectAnalysisFiles(root, meta)).toEqual(['../frontend/src/App.tsx'])
  })

  it('rejects package metadata whose real directory escapes through a symlink', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analysis-boundary-'))
    cleanupPaths.push(base)
    const root = path.join(base, 'project')
    const externalPackage = path.join(base, 'external-package')
    fs.mkdirSync(path.join(root, 'packages'), { recursive: true })
    fs.mkdirSync(path.join(externalPackage, 'src'), { recursive: true })
    fs.writeFileSync(path.join(externalPackage, 'src', 'External.ts'), 'export const external = true')
    fs.symlinkSync(externalPackage, path.join(root, 'packages', 'external'), 'dir')
    const meta = makeMeta(root)
    meta.packages = [{
      name: 'external',
      path: 'packages/external',
      dependencies: [],
      devDependencies: [],
    }]

    expect(collectAnalysisFiles(root, meta)).toEqual([])
  })

  it('collects root tests and Gradle src/test files once', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analysis-tests-'))
    cleanupPaths.push(root)
    fs.mkdirSync(path.join(root, 'tests'), { recursive: true })
    fs.mkdirSync(path.join(root, 'src', 'test', 'kotlin'), { recursive: true })
    fs.writeFileSync(path.join(root, 'tests', 'unit.test.ts'), 'test("unit", () => {})')
    fs.writeFileSync(path.join(root, 'src', 'test', 'kotlin', 'UnitTest.kt'), 'class UnitTest')

    expect(collectAnalysisFiles(root, makeMeta(root))).toEqual([
      'src/test/kotlin/UnitTest.kt',
      'tests/unit.test.ts',
    ])
  })

  it('collects one selected source tree and ignores unsupported or disappearing explicit files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-selected-source-'))
    cleanupPaths.push(root)
    const source = path.join(root, 'custom')
    fs.mkdirSync(path.join(source, 'nested'), { recursive: true })
    fs.writeFileSync(path.join(source, 'nested', 'service.ts'), 'export const service = true')
    fs.writeFileSync(path.join(source, 'notes.txt'), 'ignored')
    const meta = makeMeta(root)
    meta.prismaSchemaPath = 'missing.prisma'
    meta.trpcRouterPaths = ['custom/notes.txt']

    expect(collectSourceFiles(source, root)).toEqual(['custom/nested/service.ts'])
    expect(collectSourceFiles(path.join(root, 'missing'), root)).toEqual([])
    expect(collectAnalysisFiles(root, meta)).toEqual([])
  })

  it('skips workspace packages that disappear after detection', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-missing-package-'))
    cleanupPaths.push(root)
    fs.mkdirSync(root, { recursive: true })
    const meta = makeMeta(root)
    meta.packages = [{ name: 'gone', path: 'packages/gone', dependencies: [], devDependencies: [] }]
    expect(collectAnalysisFiles(root, meta)).toEqual([])
  })
})
