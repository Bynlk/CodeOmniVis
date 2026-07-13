/**
 * IncrementalAnalyzer 新鲜度状态机 + 丢变更修复测试。
 *
 * 通过 mock runAnalysis 控制分析时序,验证:
 *  - 状态在 analyzing/fresh 间正确切换并广播 STATUS_CHANGED
 *  - 分析进行中到达的新变更不会被丢弃(补跑一次)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import type { FreshnessStatus, ProjectMeta } from '@codeomnivis/shared'
import { IncrementalAnalyzer } from '../../src/incremental'
import { codeomnivisEvents, EVENTS } from '../../src/events'

vi.mock('@codeomnivis/analyzer', async () => {
  const actual = await vi.importActual<typeof import('@codeomnivis/analyzer')>('@codeomnivis/analyzer')
  return { ...actual, runAnalysis: vi.fn() }
})

const analyzerModule = await import('@codeomnivis/analyzer')
const runAnalysisMock = vi.mocked(analyzerModule.runAnalysis)

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function deferred(): Deferred {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((r) => { resolve = () => r() })
  return { promise, resolve }
}

const expressMeta: ProjectMeta = {
  root: process.cwd(),
  frontendFramework: 'unknown',
  backendFramework: 'express',
  databaseType: 'unknown',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: ['server'],
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

function makeAnalyzer(db: OmniDatabase, projectMeta?: ProjectMeta): IncrementalAnalyzer {
  return new IncrementalAnalyzer({ projectRoot: process.cwd(), dbPath: ':memory:', db, projectMeta })
}

describe('IncrementalAnalyzer freshness', () => {
  let db: OmniDatabase

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    runAnalysisMock.mockReset()
    db = new OmniDatabase(':memory:')
    await db.ready()
  })

  it('starts stale until a valid analysis has completed', () => {
    const analyzer = makeAnalyzer(db)
    expect(analyzer.getStatus()).toEqual<FreshnessStatus>({
      state: 'stale',
      lastAnalyzedAt: null,
      pendingChanges: 0,
    })
  })

  it('transitions analyzing -> fresh and records lastAnalyzedAt', async () => {
    runAnalysisMock.mockResolvedValue({
      filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
    })
    const analyzer = makeAnalyzer(db)
    const seen: string[] = []
    codeomnivisEvents.on(EVENTS.STATUS_CHANGED, (s: FreshnessStatus) => seen.push(s.state))

    await analyzer.refresh()

    const status = analyzer.getStatus()
    expect(status.state).toBe('fresh')
    expect(typeof status.lastAnalyzedAt).toBe('number')
    expect(seen).toContain('analyzing')
    expect(seen[seen.length - 1]).toBe('fresh')
    expect(runAnalysisMock).toHaveBeenCalledTimes(1)
  })

  it('passes detected project metadata to every re-analysis', async () => {
    runAnalysisMock.mockResolvedValue({
      filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
    })
    const analyzer = makeAnalyzer(db, expressMeta)

    await analyzer.refresh()

    expect(runAnalysisMock).toHaveBeenCalledWith(expect.objectContaining({ projectMeta: expressMeta }))
  })

  it('does not drop changes that arrive while analyzing (reruns once)', async () => {
    const first = deferred()
    // 第一次分析挂起,第二次立即完成
    runAnalysisMock
      .mockReturnValueOnce(first.promise.then(() => ({
        filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
      })))
      .mockResolvedValue({
        filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
      })

    const analyzer = makeAnalyzer(db)

    const running = analyzer.refresh() // 进入第一次分析(挂起)
    // 分析进行中再触发一次刷新 —— 应被记为补跑而非丢弃
    const queued = analyzer.refresh()
    await queued // 立即返回(只是排队)
    expect(analyzer.getStatus().state).toBe('analyzing')

    first.resolve()
    await running

    // 补跑应使 runAnalysis 被调用两次
    expect(runAnalysisMock).toHaveBeenCalledTimes(2)
    expect(analyzer.getStatus().state).toBe('fresh')
  })

  it('rejects and stays stale when a manual refresh fails (E-07: no false success)', async () => {
    runAnalysisMock.mockRejectedValue(new Error('boom'))
    const analyzer = makeAnalyzer(db)
    // 手动刷新失败必须传播错误,而不是 silently resolve(REST /api/analyze 才能返回 500)。
    await expect(analyzer.refresh()).rejects.toThrow('boom')
    // 失败后状态不能误报 fresh —— 即便没有残留变更,也应保持 stale 以反映数据未更新。
    expect(analyzer.getStatus().state).toBe('stale')
    expect(analyzer.getStatus().lastAnalyzedAt).toBeNull()
    expect(runAnalysisMock).toHaveBeenCalledTimes(1)
  })

  it('does not propagate failures from automatic watcher-triggered analysis', async () => {
    const first = deferred()
    // 第一次(手动)分析挂起并最终失败;补跑(自动)成功。
    runAnalysisMock
      .mockReturnValueOnce(first.promise.then(() => { throw new Error('first-fail') }))
      .mockResolvedValue({
        filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
      })

    const analyzer = makeAnalyzer(db)
    const running = analyzer.refresh()        // 第一次分析(挂起)
    const queued = analyzer.refresh()          // 分析中再次刷新 -> 记为补跑
    await queued
    first.resolve()
    // 第一次手动分析失败会传播,但补跑(自动)成功后状态恢复 fresh。
    await expect(running).rejects.toThrow('first-fail')
    expect(runAnalysisMock).toHaveBeenCalledTimes(2)
    expect(analyzer.getStatus().state).toBe('fresh')
  })
})
