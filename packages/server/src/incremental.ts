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
import type { OmniDatabase } from '@codeomnivis/analyzer'
import { runAnalysis } from '@codeomnivis/analyzer'
import type { FreshnessState, FreshnessStatus } from '@codeomnivis/shared'
import { codeomnivisEvents, EVENTS } from './events'

export interface IncrementalAnalyzerOptions {
  projectRoot: string
  dbPath: string
  db: OmniDatabase
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

export class IncrementalAnalyzer {
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private projectRoot: string
  private dbPath: string
  private readonly db: OmniDatabase
  private debounceMs: number
  private watchDirs: string[] | undefined
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  // 新鲜度状态
  private state: FreshnessState = 'fresh'
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
    this.debounceMs = options.debounceMs ?? 1000
    this.watchDirs = options.watchDirs
  }

  /** 当前监听的项目根路径。 */
  getProjectRoot(): string {
    return this.projectRoot
  }

  /**
   * 运行时切换项目根目录。
   * 停止旧监听 -> 清空旧图 -> 切换根 -> 重启监听 -> 重新分析。
   * 调用方需先确保 newRoot 是存在的目录;此处再次防御性校验。
   */
  async setProjectRoot(newRoot: string): Promise<void> {
    const resolved = path.resolve(newRoot)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Project root is not an existing directory: ${resolved}`)
    }
    if (resolved === this.projectRoot) {
      // 同一目录:直接重跑一次分析即可。
      await this.refresh()
      return
    }

    // 作废切根前启动的所有排队/在途分析:旧世代分析完成后不会再写状态或补跑。
    this.generation += 1

    // 停止旧监听(等待 watcher 真正关闭,避免关闭竞态)。
    await this.stop()

    // 串行化:等待在途分析(针对旧 root)落库完成,
    // 再 clearGraph,确保旧项目数据不会在清图之后被写回 DB。
    if (this.analysisInFlight) {
      try {
        await this.analysisInFlight
      } catch {
        // 在途分析的错误已在 triggerAnalysis 内处理,这里仅用于等待其结束。
      }
    }

    // 切换根并重置新鲜度,旧图先清空避免跨项目脏数据。
    this.projectRoot = resolved
    this.db.clearGraph()
    this.pendingChanges = 0
    this.lastChangedFile = null
    this.lastAnalyzedAt = null
    this.rerunRequested = false
    this.setState('stale')

    // 重启监听并触发首轮分析
    this.start()
    await this.refresh()
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
  async refresh(): Promise<void> {
    await this.triggerAnalysis(this.lastChangedFile)
  }

  /**
   * 触发增量分析(串行化,不丢失分析期间到达的变更)
   */
  private async triggerAnalysis(filePath: string | null): Promise<void> {
    if (this.isAnalyzing) {
      // 修复丢变更 bug:分析进行中再来变更不直接丢弃,而是标记补跑。
      console.log('[IncrementalAnalyzer] Analysis in progress, queuing rerun')
      this.rerunRequested = true
      return
    }

    // 绑定本轮分析所属世代;切根会递增 generation,使旧世代结果被丢弃。
    const myGeneration = this.generation
    const run = this.runAnalysisCycle(filePath, myGeneration)
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
  private async runAnalysisCycle(filePath: string | null, myGeneration: number): Promise<void> {
    this.isAnalyzing = true
    this.setState('analyzing')
    codeomnivisEvents.emit(EVENTS.ANALYSIS_STARTED)
    // 进入分析的瞬间,已知变更视为"被本轮消费",清零计数。
    const consumed = this.pendingChanges
    this.pendingChanges = 0

    try {
      console.log('[IncrementalAnalyzer] Running re-analysis...')
      await runAnalysis({
        projectRoot: this.projectRoot,
        dbPath: this.dbPath,
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
        await this.triggerAnalysis(next)
      } else {
        this.setState(this.pendingChanges > 0 ? 'stale' : 'fresh')
      }
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
