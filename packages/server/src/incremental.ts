/**
 * IncrementalAnalyzer — 文件变更增量分析 + 数据新鲜度跟踪
 *
 * 使用 chokidar 智能监听项目源码变更,触发增量重新分析。
 * 维护 fresh / analyzing / stale 三态新鲜度,通过 STATUS_CHANGED 事件对外广播;
 * 文件变更后 emit GRAPH_UPDATED 事件,由 WebSocket 广播给客户端。
 */

import * as path from 'path'
import * as fs from 'fs'
import chokidar from 'chokidar'
import { runAnalysis, type DbError, type OmniDatabase } from '@codeomnivis/analyzer'
import type { FreshnessState, FreshnessStatus, OmniGraph, ProjectMeta } from '@codeomnivis/shared'
import { codeomnivisEvents, EVENTS } from './events'

export interface IncrementalAnalyzerOptions {
  projectRoot: string
  dbPath: string
  db: OmniDatabase
  /** 启动时探测到的项目元数据，重分析必须复用而非猜测框架。 */
  projectMeta?: ProjectMeta
  /**
   * 要监听的目录(相对于 projectRoot)。
   * 省略时使用智能监听:监听整个 projectRoot 并按忽略规则过滤,
   * 不再依赖固定的目录猜测列表,任意源码布局都能覆盖。
   */
  watchDirs?: string[]
  /** 防抖延迟(毫秒) */
  debounceMs?: number
}

/** 监听时忽略的路径(node_modules / 构建产物 / dotfiles 等)。 */
const IGNORED_PATHS: Array<RegExp> = [
  /(^|[/\\])\../, // dotfiles
  /node_modules/,
  /\.next/,
  /[/\\]dist[/\\]/,
  /[/\\]build[/\\]/,
  /[/\\]coverage[/\\]/,
  /\.codeomnivis/,
]

/** 触发重新分析的源码文件后缀。 */
const SOURCE_FILE_RE = /\.(ts|tsx|js|jsx|prisma)$/

interface ProjectSwitchSnapshot {
  projectRoot: string
  projectMeta: ProjectMeta | undefined
  graph: OmniGraph
  errors: DbError[]
  state: FreshnessState
  lastAnalyzedAt: number | null
  pendingChanges: number
  rerunRequested: boolean
  lastChangedFile: string | null
  wasWatching: boolean
}

export class IncrementalAnalyzer {
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private projectRoot: string
  private dbPath: string
  private readonly db: OmniDatabase
  private projectMeta: ProjectMeta | undefined
  private debounceMs: number
  private watchDirs: string[] | undefined
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  // 新鲜度状态
  private state: FreshnessState = 'stale'
  private lastAnalyzedAt: number | null = null
  private pendingChanges = 0
  private isAnalyzing = false
  /** 分析进行中又来了新变更时置位,分析结束后补跑一次,避免丢失变更。 */
  private rerunRequested = false
  private lastChangedFile: string | null = null
  /**
   * 分析世代。每次切根 +1,用于作废切根前启动的在途/排队分析:
   * 旧世代分析完成后不再广播结果、不再触发补跑。
   */
  private generation = 0
  /** 当前在途分析的 promise(无在途时为 null),供切根时串行等待其落库完成。 */
  private analysisInFlight: Promise<void> | null = null

  constructor(options: IncrementalAnalyzerOptions) {
    this.projectRoot = options.projectRoot
    this.dbPath = options.dbPath
    this.db = options.db
    this.projectMeta = options.projectMeta
    this.debounceMs = options.debounceMs ?? 1000
    this.watchDirs = options.watchDirs
  }

  /** 当前监听的项目根路径。 */
  getProjectRoot(): string {
    return this.projectRoot
  }

  /**
   * 运行时切换项目根目录。
   * 停止旧监听 -> 稳定并快照旧状态 -> 分析目标 -> 成功提交或失败回滚。
   * 调用方需先确保 newRoot 是存在的目录;此处再次防御性校验。
   */
  async setProjectRoot(newRoot: string, projectMeta?: ProjectMeta): Promise<void> {
    const resolved = path.resolve(newRoot)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Project root is not an existing directory: ${resolved}`)
    }

    const wasWatching = this.watcher !== null
    // 先停止旧监听并等待在途分析完成，使快照代表一个稳定、可恢复的项目状态。
    await this.stop()
    if (this.analysisInFlight) {
      try {
        await this.analysisInFlight
      } catch {
        // 在途分析的错误已在 triggerAnalysis 内处理,这里仅用于等待其结束。
      }
    }

    const snapshot = this.captureProjectSwitchSnapshot(wasWatching)
    // 从此刻起，任何旧世代的排队结果都不能提交到目标项目状态。
    this.generation += 1

    try {
      this.projectRoot = resolved
      // 跨根目录时绝不能复用旧 metadata；同根目录且调用方未提供新值时才保留。
      this.projectMeta = resolved === snapshot.projectRoot && projectMeta === undefined
        ? snapshot.projectMeta
        : projectMeta
      if (!this.db.clearGraph()) {
        throw new Error('Failed to clear graph before project analysis')
      }
      this.pendingChanges = 0
      this.lastChangedFile = null
      this.lastAnalyzedAt = null
      this.rerunRequested = false
      this.setState('stale')

      if (wasWatching) this.start()
      await this.refresh()
    } catch (err) {
      // 作废目标世代，并停止目标 watcher 后再恢复旧项目，避免失败项目继续触发分析。
      this.generation += 1
      await this.stop()
      const rollbackError = this.restoreProjectSwitchSnapshot(snapshot)
      if (snapshot.wasWatching) this.start()
      this.setState(snapshot.state)

      const failure = err instanceof Error ? err : new Error(String(err))
      if (rollbackError !== null) {
        throw new AggregateError(
          [failure, rollbackError],
          `Project switch failed and rollback was incomplete: ${rollbackError.message}`,
          { cause: err },
        )
      }
      throw failure
    }
  }

  private captureProjectSwitchSnapshot(wasWatching: boolean): ProjectSwitchSnapshot {
    return {
      projectRoot: this.projectRoot,
      projectMeta: this.projectMeta,
      graph: this.db.loadGraph(),
      errors: this.db.getAllErrors(),
      state: this.state,
      lastAnalyzedAt: this.lastAnalyzedAt,
      pendingChanges: this.pendingChanges,
      rerunRequested: this.rerunRequested,
      lastChangedFile: this.lastChangedFile,
      wasWatching,
    }
  }

  /** Restore fields even when DB restoration fails, so roots and watcher authority never stay split. */
  private restoreProjectSwitchSnapshot(snapshot: ProjectSwitchSnapshot): Error | null {
    this.projectRoot = snapshot.projectRoot
    this.projectMeta = snapshot.projectMeta
    this.state = snapshot.state
    this.lastAnalyzedAt = snapshot.lastAnalyzedAt
    this.pendingChanges = snapshot.pendingChanges
    this.rerunRequested = snapshot.rerunRequested
    this.lastChangedFile = snapshot.lastChangedFile

    if (!this.db.clearGraph()) {
      return new Error('Failed to clear the failed target graph during rollback')
    }
    const restored = this.db.saveGraph(snapshot.graph)
    const restoredErrors = this.db.insertErrors(snapshot.errors)
    if (
      restored.nodesSaved !== snapshot.graph.nodes.length
      || restored.edgesSaved !== snapshot.graph.edges.length
      || restoredErrors !== snapshot.errors.length
    ) {
      return new Error('Failed to restore the complete project analysis snapshot')
    }
    return null
  }

  /** 当前新鲜度快照(供 REST / WS 读取)。 */
  getStatus(): FreshnessStatus {
    return {
      state: this.state,
      lastAnalyzedAt: this.lastAnalyzedAt,
      pendingChanges: this.pendingChanges,
    }
  }

  /** 切换状态并广播。 */
  private setState(next: FreshnessState): void {
    if (this.state === next) {
      codeomnivisEvents.emit(EVENTS.STATUS_CHANGED, this.getStatus())
      return
    }
    this.state = next
    codeomnivisEvents.emit(EVENTS.STATUS_CHANGED, this.getStatus())
  }

  /** 解析智能监听目标:显式 watchDirs(存在的)或整个 projectRoot。 */
  private resolveWatchTargets(): string[] {
    if (this.watchDirs && this.watchDirs.length > 0) {
      return this.watchDirs
        .map(dir => path.join(this.projectRoot, dir))
        .filter(dir => fs.existsSync(dir))
    }
    // 智能监听:监听根目录,由 IGNORED_PATHS + 后缀过滤收敛范围。
    return fs.existsSync(this.projectRoot) ? [this.projectRoot] : []
  }

  /**
   * 启动文件监听
   */
  start(): void {
    const dirsToWatch = this.resolveWatchTargets()

    if (dirsToWatch.length === 0) {
      console.warn('[IncrementalAnalyzer] No directories to watch')
      return
    }

    this.watcher = chokidar.watch(dirsToWatch, {
      ignored: IGNORED_PATHS,
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher.on('change', (filePath) => this.onFileChange(filePath))
    this.watcher.on('add', (filePath) => this.onFileChange(filePath))
    this.watcher.on('unlink', (filePath) => this.onFileChange(filePath))

    console.log(`[IncrementalAnalyzer] Smart-watching ${dirsToWatch.length} target(s)`)
  }

  /**
   * 文件变更处理(防抖)
   */
  private onFileChange(filePath: string): void {
    // 只处理 TS/JS/Prisma 文件
    if (!SOURCE_FILE_RE.test(filePath)) return

    console.log(`[IncrementalAnalyzer] File changed: ${path.relative(this.projectRoot, filePath)}`)

    // 记录待处理变更,并把状态切到 stale(除非正在分析)
    this.pendingChanges += 1
    this.lastChangedFile = filePath
    if (!this.isAnalyzing) {
      this.setState('stale')
    }

    // 防抖:多次变更只触发一次分析
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.triggerAnalysis(filePath)
    }, this.debounceMs)
  }

  /**
   * 手动触发重新分析(REST 兜底入口)。
   * 与文件监听共用串行化逻辑;分析进行中则记为补跑请求。
   */
  async refresh(onFilesCollected?: (count: number) => void): Promise<void> {
    // manual=true:手动刷新失败必须向调用方传播,避免 REST /api/analyze 误报 success(E-07)。
    await this.triggerAnalysis(this.lastChangedFile, true, onFilesCollected)
  }

  /**
   * 触发增量分析(串行化,不丢失分析期间到达的变更)
   */
  private async triggerAnalysis(
    filePath: string | null,
    manual = false,
    onFilesCollected?: (count: number) => void,
  ): Promise<void> {
    if (this.isAnalyzing) {
      // 修复丢变更 bug:分析进行中再来变更不直接丢弃,而是标记补跑。
      console.log('[IncrementalAnalyzer] Analysis in progress, queuing rerun')
      this.rerunRequested = true
      return
    }

    // 绑定本轮分析所属世代;切根会递增 generation,使旧世代结果被丢弃。
    const myGeneration = this.generation
    const run = this.runAnalysisCycle(filePath, myGeneration, manual, onFilesCollected)
    this.analysisInFlight = run
    try {
      await run
    } finally {
      // 仅当没有更新的在途分析覆盖时,才清空句柄。
      if (this.analysisInFlight === run) {
        this.analysisInFlight = null
      }
    }
  }

  /** 实际执行一轮分析;myGeneration 用于切根后作废过期结果。 */
  private async runAnalysisCycle(
    filePath: string | null,
    myGeneration: number,
    manual: boolean,
    onFilesCollected?: (count: number) => void,
  ): Promise<void> {
    this.isAnalyzing = true
    this.setState('analyzing')
    codeomnivisEvents.emit(EVENTS.ANALYSIS_STARTED)
    // 进入分析的瞬间,已知变更视为"被本轮消费",清零计数。
    const consumed = this.pendingChanges
    this.pendingChanges = 0

    // 本轮分析的失败原因;非空表示分析失败,用于:1) 收尾时置 stale 而非 fresh;
    // 2) 手动刷新(manual)向调用方传播,避免 REST /api/analyze 误报 success(E-07)。
    let failure: unknown = null

    try {
      console.log('[IncrementalAnalyzer] Running re-analysis...')
      await runAnalysis({
        projectRoot: this.projectRoot,
        dbPath: this.dbPath,
        projectMeta: this.projectMeta,
        onFilesCollected,
        // 共享 server 持有的同一 DB 句柄(修复 RACE-01::memory: 下查询层才读得到结果)。
        db: this.db,
      })
      // 切根作废:本轮针对的是旧 root,结果不再广播,也不更新新鲜度。
      if (myGeneration !== this.generation) {
        console.log('[IncrementalAnalyzer] Stale analysis (root switched), discarding result')
        return
      }
      console.log('[IncrementalAnalyzer] Re-analysis complete')
      this.lastAnalyzedAt = Date.now()
      codeomnivisEvents.emit(EVENTS.GRAPH_UPDATED, filePath)
      codeomnivisEvents.emit(EVENTS.ANALYSIS_COMPLETED)
    } catch (err) {
      console.error('[IncrementalAnalyzer] Analysis failed:', err)
      failure = err
      // 失败:把消费掉的变更归还,保持 stale 以便重试。
      this.pendingChanges += consumed
    } finally {
      this.isAnalyzing = false
      if (myGeneration !== this.generation) {
        // 世代已过期(切根):不补跑、不改新鲜度,交由新世代流程接管。
        this.rerunRequested = false
      } else if (this.rerunRequested) {
        // 分析期间有新变更到达,立即补跑一次。
        this.rerunRequested = false
        const next = this.lastChangedFile
        // 补跑属自动重试,失败不向手动调用方传播,故 manual=false。
        await this.triggerAnalysis(next)
      } else {
        // 失败时强制 stale(即便无残留变更也不能误报 fresh);成功才按残留变更决定。
        this.setState(failure !== null || this.pendingChanges > 0 ? 'stale' : 'fresh')
      }
    }

    // 手动刷新失败:向调用方传播错误,使 REST /api/analyze 返回 500 而非 success。
    // 自动(watcher)触发的失败保持吞掉,仅靠 stale 状态 + 下次变更重试。
    if (manual && failure !== null) {
      throw failure instanceof Error ? failure : new Error(String(failure))
    }
  }

  /**
   * 停止文件监听
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      const watcher = this.watcher
      this.watcher = null
      // 等待 chokidar 真正释放 fs 句柄,避免关闭竞态。
      await watcher.close()
    }
    console.log('[IncrementalAnalyzer] Stopped')
  }
}
