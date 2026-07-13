import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))

describe('README contract', () => {
  it('keeps local links, visuals, commands, search intent, and translations aligned', () => {
    const result = spawnSync(process.execPath, ['scripts/verifyReadme.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    expect(result.status, result.stderr || result.stdout).toBe(0)
  })
})
