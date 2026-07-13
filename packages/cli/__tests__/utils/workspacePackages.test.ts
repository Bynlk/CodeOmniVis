import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { discoverWorkspacePackages } from '../../src/utils/workspacePackages'

describe('discoverWorkspacePackages', () => {
  const cleanupPaths: string[] = []

  afterEach(() => {
    for (const cleanupPath of cleanupPaths.splice(0)) {
      fs.rmSync(cleanupPath, { recursive: true, force: true })
    }
  })

  it('reads pnpm and package.json workspace patterns deterministically', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-workspaces-'))
    cleanupPaths.push(root)
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ workspaces: ['demo'] }))

    for (const [packagePath, name] of [['packages/ui', '@fixture/ui'], ['packages/api', '@fixture/api'], ['demo', 'demo']]) {
      fs.mkdirSync(path.join(root, packagePath), { recursive: true })
      fs.writeFileSync(path.join(root, packagePath, 'package.json'), JSON.stringify({
        name,
        dependencies: name === '@fixture/ui' ? { react: '19.0.0' } : {},
      }))
    }

    const packages = discoverWorkspacePackages(root)

    expect(packages.map(pkg => pkg.path)).toEqual(['demo', 'packages/api', 'packages/ui'])
    expect(packages.find(pkg => pkg.path === 'packages/ui')?.dependencies).toEqual(['react'])
  })

  it('skips a malformed child manifest without dropping valid packages', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-workspace-malformed-'))
    cleanupPaths.push(root)
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - packages/*\n")
    fs.mkdirSync(path.join(root, 'packages', 'valid'), { recursive: true })
    fs.mkdirSync(path.join(root, 'packages', 'broken'), { recursive: true })
    fs.writeFileSync(path.join(root, 'packages', 'valid', 'package.json'), JSON.stringify({ name: 'valid' }))
    fs.writeFileSync(path.join(root, 'packages', 'broken', 'package.json'), '{broken')

    expect(discoverWorkspacePackages(root).map(pkg => pkg.name)).toEqual(['valid'])
  })

  it('rejects a workspace symlink whose real package directory escapes the project root', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-workspace-boundary-'))
    cleanupPaths.push(base)
    const root = path.join(base, 'project')
    const external = path.join(base, 'external-package')
    fs.mkdirSync(path.join(root, 'packages'), { recursive: true })
    fs.mkdirSync(external)
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
    fs.writeFileSync(path.join(external, 'package.json'), JSON.stringify({ name: 'external' }))
    fs.symlinkSync(external, path.join(root, 'packages', 'external'), 'dir')

    expect(discoverWorkspacePackages(root)).toEqual([])
  })
})
