import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface CliPackageManifest {
  name: string
  description: string
  engines?: Record<string, string>
  bugs?: { url: string }
  publishConfig?: Record<string, string>
  files?: string[]
  keywords?: string[]
}

function readCliPackageManifest(): CliPackageManifest {
  return JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as CliPackageManifest
}

describe('public CLI package metadata', () => {
  it('defines the searchable lowercase npm package contract', () => {
    const manifest = readCliPackageManifest()

    expect(manifest.name).toBe('@bynlk/codeomnivis')
    expect(manifest.description).toContain('TypeScript')
    expect(manifest.engines).toEqual({ node: '>=18.17.0' })
    expect(manifest.bugs).toEqual({ url: 'https://github.com/Bynlk/CodeOmniVis/issues' })
    expect(manifest.publishConfig).toEqual({
      access: 'public',
      registry: 'https://registry.npmjs.org',
    })
    expect(manifest.files).toEqual(expect.arrayContaining(['dist', 'bin', 'README.md', 'LICENSE']))
    expect(manifest.keywords).toEqual(expect.arrayContaining([
      'typescript',
      'architecture-visualization',
      'nextjs',
      'react',
      'prisma',
      'mcp',
    ]))
  })
})
