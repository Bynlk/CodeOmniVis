import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTestRunPlan, runTestRunner } from '../../src/utils/testRunner'

describe('bounded test runner', () => {
  it('builds an argv-only Vitest plan with no shell', () => {
    const plan = createTestRunPlan({ projectRoot: process.cwd(), runner: 'vitest', timeoutMs: 1_000, extraArgs: ['src/a.test.ts'] })
    expect(plan.command).toBe('pnpm')
    expect(plan.args).toEqual(['exec', 'vitest', '--run', 'src/a.test.ts'])
    expect(plan.options).toMatchObject({ shell: false, cwd: process.cwd() })
  })

  it('rejects unsafe arguments before spawning', () => {
    expect(() => createTestRunPlan({ projectRoot: process.cwd(), runner: 'jest', timeoutMs: 1_000, extraArgs: ['bad\0arg'] })).toThrow('NUL')
    expect(() => createTestRunPlan({ projectRoot: process.cwd(), runner: 'jest', timeoutMs: 1_000, extraArgs: ['/outside.test.ts'] })).toThrow('outside')
  })

  it('runs only an explicit validated Gradle wrapper', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-run-'))
    try {
      const wrapper = path.join(root, 'gradlew')
      fs.writeFileSync(wrapper, '#!/bin/sh\nprintf "ok"\n')
      fs.chmodSync(wrapper, 0o700)
      const result = await runTestRunner({ projectRoot: root, runner: 'gradle', timeoutMs: 2_000, extraArgs: [] })
      expect(result).toMatchObject({ exitCode: 0, timedOut: false, stdout: 'ok', truncated: false })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
