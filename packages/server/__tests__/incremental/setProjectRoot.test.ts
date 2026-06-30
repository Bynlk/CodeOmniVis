/**
 * IncrementalAnalyzer.setProjectRoot 运行时切换项目根测试。
 *
 * 通过 mock runAnalysis 控制分析时序,验证:
 *  - 切换到不存在的目录抛错
 *  - 切换到新目录会清空旧图、更新 getProjectRoot 并重新分析
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { IncrementalAnalyzer } from '../../src/incremental'
import { codeomnivisEvents } from '../../src/events'

vi.mock('@codeomnivis/analyzer', async () => {
  const actual = await vi.importActual<typeof import('@codeomnivis/analyzer')>('@codeomnivis/analyzer')
  return { ...actual, runAnalysis: vi.fn() }
})

const analyzerModule = await import('@codeomnivis/analyzer')
const runAnalysisMock = vi.mocked(analyzerModule.runAnalysis)

describe('IncrementalAnalyzer.setProjectRoot', () => {
  let db: OmniDatabase
  let dirA: string
  let dirB: string

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    runAnalysisMock.mockReset()
    runAnalysisMock.mockResolvedValue({
      filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
    })
    db = new OmniDatabase(':memory:')
    await db.ready()
    dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-rootA-'))
    dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-rootB-'))
  })

  afterEach(() => {
    fs.rmSync(dirA, { recursive: true, force: true })
    fs.rmSync(dirB, { recursive: true, force: true })
  })

  it('reports the initial project root', () => {
    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    expect(analyzer.getProjectRoot()).toBe(path.resolve(dirA))
  })

  it('throws when target is not an existing directory', async () => {
    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    await expect(analyzer.setProjectRoot(path.join(dirA, 'does-not-exist'))).rejects.toThrow()
    expect(analyzer.getProjectRoot()).toBe(path.resolve(dirA))
  })

  it('switches to a new directory and re-runs analysis', async () => {
    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    await analyzer.setProjectRoot(dirB)
    expect(analyzer.getProjectRoot()).toBe(path.resolve(dirB))
    expect(runAnalysisMock).toHaveBeenCalled()
    analyzer.stop()
  })

  it('clears existing graph data when switching roots', async () => {
    const clearSpy = vi.spyOn(db, 'clearGraph')
    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    await analyzer.setProjectRoot(dirB)
    expect(clearSpy).toHaveBeenCalled()
    analyzer.stop()
  })
})
