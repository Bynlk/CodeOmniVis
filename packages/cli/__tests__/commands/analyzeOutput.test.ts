import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { runAnalyze } from '../../src/commands/analyze'

const roots: string[] = []

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analyze-output-'))
  roots.push(root)
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { next: '14.0.0' } }))
  fs.mkdirSync(path.join(root, 'app'), { recursive: true })
  fs.writeFileSync(path.join(root, 'app', 'page.tsx'), 'export default function Page() { return null }')
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('analyze output modes', () => {
  it('writes a machine-readable snapshot envelope only to stdout', async () => {
    const root = fixture()
    let stdout = ''
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      stdout += String(chunk)
      return true
    })
    const progress: string[] = []

    await runAnalyze(
      { project: root, output: '-', json: true },
      {
        openDatabase: () => new OmniDatabase(path.join(root, 'graph.db')),
        onProgress: message => progress.push(message),
      },
    )

    expect(write).toHaveBeenCalledTimes(1)
    const body = JSON.parse(stdout)
    expect(body.meta.snapshotDigest).toBe(body.data.snapshotDigest)
    expect(progress).toContain('Detecting project structure...')
    expect(progress.some(message => message.startsWith('Parsing '))).toBe(true)
  })

  it('prints the graph when output is a dash', async () => {
    const root = fixture()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runAnalyze(
      { project: root, output: '-' },
      { openDatabase: () => new OmniDatabase(path.join(root, 'graph.db')) },
    )
    expect(log.mock.calls.some(call => typeof call[0] === 'string' && call[0].includes('"nodes"'))).toBe(true)
  })
})
