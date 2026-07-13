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
import type { OmniEdge, OmniNode, ProjectMeta } from '@codeomnivis/shared'
import { IncrementalAnalyzer } from '../../src/incremental'
import { codeomnivisEvents } from '../../src/events'

vi.mock('@codeomnivis/analyzer', async () => {
  const actual = await vi.importActual<typeof import('@codeomnivis/analyzer')>('@codeomnivis/analyzer')
  return { ...actual, runAnalysis: vi.fn() }
})

const analyzerModule = await import('@codeomnivis/analyzer')
const runAnalysisMock = vi.mocked(analyzerModule.runAnalysis)

function projectMeta(root: string, backendFramework: ProjectMeta['backendFramework']): ProjectMeta {
  return {
    root,
    frontendFramework: 'unknown',
    backendFramework,
    databaseType: 'unknown',
    monorepoType: 'none',
    frontendDirs: [],
    backendDirs: [],
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
}

const retainedPage: OmniNode = {
  id: 'page:app/page.tsx:/',
  type: 'page',
  name: '/',
  filePath: 'app/page.tsx',
  line: 1,
  column: 1,
  metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
}

const retainedComponent: OmniNode = {
  id: 'component:components/Nav.tsx:Nav',
  type: 'component',
  name: 'Nav',
  filePath: 'components/Nav.tsx',
  line: 1,
  column: 1,
  metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
}

const retainedEdge: OmniEdge = {
  id: 'page:app/page.tsx:/--renders--component:components/Nav.tsx:Nav',
  source: retainedPage.id,
  target: retainedComponent.id,
  type: 'renders',
  confidence: 'certain',
  metadata: {},
}

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

  it('uses metadata detected for the target directory', async () => {
    const initialMeta = projectMeta(dirA, 'trpc')
    const targetMeta = projectMeta(dirB, 'express')
    const analyzer = new IncrementalAnalyzer({
      projectRoot: dirA,
      dbPath: ':memory:',
      db,
      projectMeta: initialMeta,
    })

    await analyzer.setProjectRoot(dirB, targetMeta)

    expect(runAnalysisMock).toHaveBeenLastCalledWith(expect.objectContaining({
      projectRoot: path.resolve(dirB),
      projectMeta: targetMeta,
    }))
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

    // 触发切根;它应:stop(await watcher) → await 在途分析 → snapshot → bump generation → clearGraph。
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

  it('finishes an in-flight old-root analysis before analyzing the target root', async () => {
    let releaseFirst: () => void = () => {}
    const firstDone = new Promise<void>((resolve) => {
      releaseFirst = () => resolve()
    })
    const result = { filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0 }
    const analyzedRoots: string[] = []
    // 首轮(旧 root)阻塞;后续轮(新 root)立即完成。
    runAnalysisMock.mockImplementationOnce(async ({ projectRoot }) => {
      analyzedRoots.push(projectRoot)
      await firstDone
      return result
    })
    runAnalysisMock.mockImplementationOnce(async ({ projectRoot }) => {
      analyzedRoots.push(projectRoot)
      return result
    })

    const analyzer = new IncrementalAnalyzer({ projectRoot: dirA, dbPath: ':memory:', db })
    const inFlight = analyzer.refresh()

    // 切根会先等待旧分析稳定落库，再快照并开始目标分析。
    const switching = analyzer.setProjectRoot(dirB)
    releaseFirst()
    await inFlight
    await switching

    expect(analyzedRoots).toEqual([path.resolve(dirA), path.resolve(dirB)])
    expect(analyzer.getProjectRoot()).toBe(path.resolve(dirB))
    await analyzer.stop()
  })

  it('restores the previous project snapshot when target analysis fails', async () => {
    const initialMeta = projectMeta(dirA, 'trpc')
    const analyzer = new IncrementalAnalyzer({
      projectRoot: dirA,
      dbPath: ':memory:',
      db,
      projectMeta: initialMeta,
    })
    db.upsertNodes([retainedPage, retainedComponent])
    db.upsertEdge(retainedEdge)
    db.insertError({ file: 'app/page.tsx', message: 'retained warning', severity: 'warning' })
    await analyzer.refresh()
    const previousStatus = analyzer.getStatus()

    runAnalysisMock.mockImplementationOnce(async ({ db: targetDb }) => {
      targetDb?.clearGraph()
      throw new Error('target analysis failed')
    })

    try {
      await expect(analyzer.setProjectRoot(dirB, projectMeta(dirB, 'express')))
        .rejects.toThrow('target analysis failed')

      expect(analyzer.getProjectRoot()).toBe(path.resolve(dirA))
      expect(db.loadGraph()).toEqual({
        nodes: [retainedPage, retainedComponent],
        edges: [retainedEdge],
      })
      expect(db.getAllErrors()).toEqual([{
        file: 'app/page.tsx',
        message: 'retained warning',
        severity: 'warning',
        originalError: undefined,
      }])
      expect(analyzer.getStatus()).toEqual(previousStatus)
    } finally {
      await analyzer.stop()
    }
  })

  it('restores previous metadata and graph when same-root analysis fails', async () => {
    const initialMeta = projectMeta(dirA, 'trpc')
    const replacementMeta = projectMeta(dirA, 'express')
    const analyzer = new IncrementalAnalyzer({
      projectRoot: dirA,
      dbPath: ':memory:',
      db,
      projectMeta: initialMeta,
    })
    db.upsertNode(retainedPage)
    await analyzer.refresh()

    runAnalysisMock.mockImplementationOnce(async ({ db: targetDb }) => {
      targetDb?.clearGraph()
      throw new Error('same-root analysis failed')
    })

    try {
      await expect(analyzer.setProjectRoot(dirA, replacementMeta))
        .rejects.toThrow('same-root analysis failed')
      expect(db.getAllNodes()).toEqual([retainedPage])

      await analyzer.refresh()
      expect(runAnalysisMock).toHaveBeenLastCalledWith(expect.objectContaining({
        projectRoot: path.resolve(dirA),
        projectMeta: initialMeta,
      }))
    } finally {
      await analyzer.stop()
    }
  })
})
