import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createCliProgram } from '../../src/program'

describe('public CLI contract', () => {
  it('keeps every existing public command', () => {
    const commandNames = createCliProgram().commands.map(command => command.name())

    expect(commandNames).toEqual(
      expect.arrayContaining(['analyze', 'check', 'init', 'mcp', 'serve', 'test-import']),
    )
  })

  it('reports the published package version', () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    )
    if (
      typeof manifest !== 'object'
      || manifest === null
      || !('version' in manifest)
      || typeof manifest.version !== 'string'
    ) {
      throw new Error('packages/cli/package.json must contain a string version')
    }

    expect(createCliProgram().version()).toBe(manifest.version)
  })
})
