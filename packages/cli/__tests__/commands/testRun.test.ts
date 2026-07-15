import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestRunPlan, runTestRunner } from '../../src/utils/testRunner'
import { runTestCommand } from '../../src/commands/testRun'

describe('bounded test runner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('builds an argv-only Vitest plan with no shell', () => {
    const plan = createTestRunPlan({
      projectRoot: process.cwd(),
      runner: 'vitest',
      timeoutMs: 1_000,
      extraArgs: ['src/a.test.ts'],
    })
    expect(plan.command).toBe('pnpm')
    expect(plan.args).toEqual(['exec', 'vitest', '--run', 'src/a.test.ts'])
    expect(plan.options).toMatchObject({ shell: false, cwd: process.cwd() })
  })

  it.each([
    ['jest', ['exec', 'jest', '--runInBand']],
    ['playwright', ['exec', 'playwright', 'test']],
    ['cypress', ['exec', 'cypress', 'run']],
  ] as const)('builds the fixed %s runner command', (runner, expectedArgs) => {
    const plan = createTestRunPlan({
      projectRoot: process.cwd(),
      runner,
      timeoutMs: 1_000,
      extraArgs: [],
    })

    expect(plan.command).toBe('pnpm')
    expect(plan.args).toEqual(expectedArgs)
    expect(plan.options.shell).toBe(false)
  })

  it('rejects timeouts outside the bounded execution window', () => {
    expect(() =>
      createTestRunPlan({
        projectRoot: process.cwd(),
        runner: 'vitest',
        timeoutMs: 999,
        extraArgs: [],
      }),
    ).toThrow('between 1000 and 1800000')
  })

  it('rejects unsafe arguments before spawning', () => {
    expect(() =>
      createTestRunPlan({
        projectRoot: process.cwd(),
        runner: 'jest',
        timeoutMs: 1_000,
        extraArgs: ['bad\0arg'],
      }),
    ).toThrow('NUL')
    expect(() =>
      createTestRunPlan({
        projectRoot: process.cwd(),
        runner: 'jest',
        timeoutMs: 1_000,
        extraArgs: ['/outside.test.ts'],
      }),
    ).toThrow('outside')
  })

  it('runs only an explicit validated Gradle wrapper', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-run-'))
    try {
      const isWindows = process.platform === 'win32'
      const wrapper = path.join(root, isWindows ? 'gradlew.bat' : 'gradlew')
      fs.writeFileSync(
        wrapper,
        isWindows ? '@echo off\r\n<nul set /p "=ok"\r\nexit /b 0\r\n' : '#!/bin/sh\nprintf "ok"\n',
      )
      if (!isWindows) fs.chmodSync(wrapper, 0o700)
      const result = await runTestRunner({
        projectRoot: root,
        runner: 'gradle',
        timeoutMs: 10_000,
        extraArgs: [],
      })
      expect(result).toMatchObject({ exitCode: 0, timedOut: false, stdout: 'ok', truncated: false })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('routes a Windows Gradle wrapper through cmd.exe without enabling a shell', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-plan-'))
    const wrapper = path.join(root, 'gradlew.bat')
    fs.writeFileSync(wrapper, '@echo off\r\n')
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('ComSpec', 'C:\\Windows\\System32\\cmd.exe')

    try {
      const plan = createTestRunPlan({
        projectRoot: root,
        runner: 'gradle',
        timeoutMs: 1_000,
        extraArgs: ['--tests', 'com.example.OrderTest'],
      })

      expect(plan.command).toBe('C:\\Windows\\System32\\cmd.exe')
      expect(plan.args).toEqual([
        '/d',
        '/s',
        '/c',
        'gradlew.bat',
        'test',
        '--tests',
        'com.example.OrderTest',
      ])
      expect(plan.options).toMatchObject({ cwd: root, shell: false })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(['&', '|', '<', '>', '(', ')', '^', '%', '!', '"', '\r', '\n'])(
    'rejects the Windows cmd metacharacter %j in Gradle arguments',
    (metacharacter) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-plan-'))
      fs.writeFileSync(path.join(root, 'gradlew.bat'), '@echo off\r\n')
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')

      try {
        expect(() =>
          createTestRunPlan({
            projectRoot: root,
            runner: 'gradle',
            timeoutMs: 1_000,
            extraArgs: [`safe${metacharacter}whoami`],
          }),
        ).toThrow('Windows command metacharacters')
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it('reports the explicit plan, imports requested JUnit, and preserves a failing exit code', async () => {
    const run = vi.fn(async () => ({
      exitCode: 2,
      signal: null,
      timedOut: false,
      stdout: 'out',
      stderr: 'err',
      truncated: false,
    }))
    const importResults = vi.fn(async () => ({ importedFiles: 1, cases: 1, unmatched: 0 }))
    const stdout = vi.fn()
    const stderr = vi.fn()
    process.exitCode = undefined

    await runTestCommand(
      ['tests/order.test.ts'],
      {
        project: process.cwd(),
        runner: 'vitest',
        timeout: '1000',
        junit: 'results.xml',
      },
      { run, importResults, stdout, stderr },
    )

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: process.cwd(),
        runner: 'vitest',
        timeoutMs: 1000,
        extraArgs: ['tests/order.test.ts'],
      }),
    )
    expect(importResults).toHaveBeenCalledWith({ project: process.cwd(), junit: 'results.xml' })
    expect(stdout).toHaveBeenCalledWith('out')
    expect(stderr.mock.calls.flat().join('')).toContain('test-run')
    expect(process.exitCode).toBe(2)
    process.exitCode = undefined
  })
})
