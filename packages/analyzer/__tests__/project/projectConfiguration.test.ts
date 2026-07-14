import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectMeta } from '@codeomnivis/shared'
import { collectConfiguredScanDirs } from '../../src/project/collectScanDirs'
import { applyProjectConfig } from '../../src/project/configureProject'
import { discoverWorkspacePackages } from '../../src/project/workspacePackages'

const cleanup: string[] = []

function temporaryProject(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  cleanup.push(root)
  return root
}

function projectMeta(root: string): ProjectMeta {
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

afterEach(() => {
  for (const target of cleanup.splice(0)) fs.rmSync(target, { recursive: true, force: true })
})

describe('project configuration', () => {
  it('prefers existing explicit scan directories and removes duplicates', () => {
    const root = temporaryProject('covis-configured-scan-')
    fs.mkdirSync(path.join(root, 'client'), { recursive: true })
    fs.mkdirSync(path.join(root, 'server'), { recursive: true })

    expect(
      collectConfiguredScanDirs(root, {
        frontend: { dirs: ['client', 'client'] },
        backend: { dirs: ['server', 'missing'] },
      }),
    ).toEqual([path.join(root, 'client'), path.join(root, 'server')])
  })

  it('discovers conventional and workspace source roots without following escaping symlinks', () => {
    const base = temporaryProject('covis-auto-scan-')
    const root = path.join(base, 'project')
    const outside = path.join(base, 'outside')
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.mkdirSync(path.join(root, 'packages', 'web', 'src'), { recursive: true })
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
    fs.writeFileSync(
      path.join(root, 'packages', 'web', 'package.json'),
      JSON.stringify({ name: 'web' }),
    )
    fs.symlinkSync(outside, path.join(root, 'components'), 'dir')

    expect(collectConfiguredScanDirs(root)).toEqual([
      path.join(root, 'src'),
      path.join(root, 'packages', 'web', 'src'),
    ])
  })

  it('applies supported overrides and rejects configured symlinks escaping the root', () => {
    const base = temporaryProject('covis-project-config-')
    const root = path.join(base, 'project')
    const outside = path.join(base, 'outside')
    fs.mkdirSync(path.join(root, 'web'), { recursive: true })
    fs.mkdirSync(path.join(root, 'api'), { recursive: true })
    fs.mkdirSync(path.join(root, 'prisma'), { recursive: true })
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(root, 'prisma', 'schema.prisma'), '')
    fs.symlinkSync(outside, path.join(root, 'entities'), 'dir')
    const meta = projectMeta(root)
    const realRoot = fs.realpathSync.native(root)

    expect(
      applyProjectConfig(meta, {
        frontend: { framework: 'next', dirs: ['web'] },
        backend: { framework: 'express', dirs: ['api'] },
        database: { prismaSchema: 'prisma/schema.prisma', typeormDirs: ['entities'] },
      }),
    ).toMatchObject({
      frontendFramework: 'next',
      backendFramework: 'express',
      frontendDirs: [path.join(realRoot, 'web')],
      backendDirs: [path.join(realRoot, 'api')],
      prismaSchemaPath: path.join(realRoot, 'prisma', 'schema.prisma'),
      typeormEntityDirs: [],
    })
  })

  it('leaves metadata unchanged for absent or unsupported overrides', () => {
    const root = temporaryProject('covis-project-config-empty-')
    const meta = projectMeta(root)
    expect(applyProjectConfig(meta, undefined)).toBe(meta)
    expect(
      applyProjectConfig(meta, {
        frontend: { framework: 'react' },
        backend: { framework: 'fastify' },
      }),
    ).toMatchObject({ frontendFramework: 'unknown', backendFramework: 'unknown' })
  })
})

describe('workspace package discovery', () => {
  it('merges pnpm and package workspaces and normalizes dependency names', () => {
    const root = temporaryProject('covis-workspaces-')
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        workspaces: { packages: ['apps/*'] },
      }),
    )
    for (const [relative, manifest] of [
      [
        'packages/api',
        {
          name: '@demo/api',
          dependencies: { zod: '*', express: '*' },
          devDependencies: { vitest: '*' },
        },
      ],
      ['apps/web', { dependencies: ['invalid'] }],
    ] as const) {
      fs.mkdirSync(path.join(root, relative), { recursive: true })
      fs.writeFileSync(path.join(root, relative, 'package.json'), JSON.stringify(manifest))
    }

    expect(discoverWorkspacePackages(root)).toEqual([
      { name: 'apps/web', path: 'apps/web', dependencies: [], devDependencies: [] },
      {
        name: '@demo/api',
        path: 'packages/api',
        dependencies: ['express', 'zod'],
        devDependencies: ['vitest'],
      },
    ])
  })

  it('falls back to packages/* for Turbo and skips malformed manifests', () => {
    const root = temporaryProject('covis-turbo-workspaces-')
    fs.writeFileSync(path.join(root, 'turbo.json'), '{}')
    fs.mkdirSync(path.join(root, 'packages', 'valid'), { recursive: true })
    fs.mkdirSync(path.join(root, 'packages', 'broken'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'packages', 'valid', 'package.json'),
      JSON.stringify({ name: 'valid' }),
    )
    fs.writeFileSync(path.join(root, 'packages', 'broken', 'package.json'), '{broken')

    expect(discoverWorkspacePackages(root).map((item) => item.name)).toEqual(['valid'])
  })

  it('returns an empty list when no workspace contract exists', () => {
    const root = temporaryProject('covis-no-workspaces-')
    fs.writeFileSync(path.join(root, 'package.json'), '{broken')
    expect(discoverWorkspacePackages(root)).toEqual([])
  })
})
