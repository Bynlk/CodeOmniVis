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
    await analyzer.stop()
  })

  it('clears existing graph data when switching roots', async () => {
    const clearSpy = vi.spyOn(db, 'clearGraph')
    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    await analyzer.setProjectRoot(dirB)
    expect(clearSpy).toHaveBeenCalled()
    await analyzer.stop()
  })

  it('awaits watcher close and in-flight analysis before clearing graph on root switch', async () => {
    // 受控的在途分析:首轮(旧 root)阻塞,直到我们放行。
    let releaseFirst: () => void = () => {}
    const firstDone = new Promise<void>((resolve) => {
      releaseFirst = () => resolve()
    })
    const result = { filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0 }
    runAnalysisMock.mockImplementationOnce(async () => {
      await firstDone
      return result
    })

    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    // 启动针对旧 root 的在途分析(不 await)。
    const inFlight = analyzer.refresh()

    const clearSpy = vi.spyOn(db, 'clearGraph')
    let clearedBeforeFirstDone = false
    clearSpy.mockImplementation(() => {
      // clearGraph 必须发生在在途分析落库之后(串行化保证)。
      // 此处若 releaseFirst 仍未触发,则说明未等待在途分析。
      return true
    })

    // 触发切根;它应:bump generation → stop(await watcher) → await 在途分析 → clearGraph。
    const switching = analyzer.setProjectRoot(dirB)

    // 在途分析此刻仍阻塞,clearGraph 不应被调用(被串行化阻塞)。
    await Promise.resolve()
    clearedBeforeFirstDone = clearSpy.mock.calls.length > 0
    expect(clearedBeforeFirstDone).toBe(false)

    // 放行旧分析 → setProjectRoot 得以继续。
    releaseFirst()
    await inFlight
    await switching

    expect(clearSpy).toHaveBeenCalled()
    expect(analyzer.getProjectRoot()).toBe(path.resolve(dirB))
    await analyzer.stop()
  })

  it('discards a stale analysis result started before the root switch', async () => {
    let releaseFirst: () => void = () => {}
    const firstDone = new Promise<void>((resolve) => {
      releaseFirst = () => resolve()
    })
    const result = { filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0 }
    // 首轮(旧 root)阻塞;后续轮(新 root)立即完成。
    runAnalysisMock.mockImplementationOnce(async () => {
      await firstDone
      return result
    })
    runAnalysisMock.mockResolvedValue(result)

    const completedEvents: number[] = []
    codeomnivisEvents.on('analysis:completed', () => completedEvents.push(Date.now()))

    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    const inFlight = analyzer.refresh()

    // 切根:作废旧世代;它会 await 旧在途分析,但旧分析仍阻塞。
    const switching = analyzer.setProjectRoot(dirB)
    releaseFirst()
    await inFlight
    await switching

    // 旧世代分析结果被丢弃:不应保留指向旧 root 的状态。
    expect(analyzer.getProjectRoot()).toBe(path.resolve(dirB))
    await analyzer.stop()
  })
})
