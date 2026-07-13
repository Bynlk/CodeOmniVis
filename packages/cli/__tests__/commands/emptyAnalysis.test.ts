import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { runAnalyze } from '../../src/commands/analyze'
import { runCheck } from '../../src/commands/check'

describe('empty analysis command semantics', () => {
  const roots: string[] = []

  afterEach(() => {
    vi.restoreAllMocks()
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  })

  it('analyze rejects a project with no supported source files', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analyze-empty-'))
    roots.push(projectRoot)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runAnalyze(
      { project: projectRoot, output: '-' },
      { openDatabase: dbPath => new OmniDatabase(dbPath) },
    )).rejects.toMatchObject({ code: 'NO_SUPPORTED_FILES' })

    expect(logSpy.mock.calls.flat().join(' ')).not.toContain('Analysis complete')
  })

  it('check rejects an empty project instead of reporting it clean', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-check-empty-'))
    roots.push(projectRoot)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runCheck({
      cwd: projectRoot,
      openDatabase: dbPath => new OmniDatabase(dbPath),
    })).rejects.toMatchObject({ code: 'NO_SUPPORTED_FILES' })

    expect(logSpy.mock.calls.flat().join(' ')).not.toContain('No consistency issues found')
  })
})
