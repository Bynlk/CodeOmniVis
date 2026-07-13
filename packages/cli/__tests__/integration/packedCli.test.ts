import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface PackFile {
  path: string
}

interface PackResult {
  name: string
  files: PackFile[]
}

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const cliRoot = resolve(repoRoot, 'packages/cli')

describe('packed CLI distribution', () => {
  it('contains runtime assets and excludes workspace-only files', () => {
    const result = spawnSync('npm', [
      'pack',
      '--dry-run',
      '--json',
      '--registry=https://registry.npmjs.org',
    ], {
      cwd: cliRoot,
      encoding: 'utf8',
    })

    expect(result.status, result.stderr || result.stdout).toBe(0)
    const [packed] = JSON.parse(result.stdout) as PackResult[]
    const paths = packed.files.map(file => file.path)

    expect(packed.name).toBe('@bynlk/codeomnivis')
    expect(paths).toContain('bin/codeomnivis.js')
    expect(paths).toContain('dist/index.js')
    expect(paths.some(path => path.startsWith('dist/ui/assets/'))).toBe(true)
    expect(paths).toContain('dist/wasm/tree-sitter-kotlin.wasm')
    expect(paths).toContain('README.md')
    expect(paths).toContain('LICENSE')
    expect(paths.some(path => /(?:^|\/)(?:src|__tests__|\.planning|\.superpowers)(?:\/|$)/u.test(path))).toBe(false)
  })
})
