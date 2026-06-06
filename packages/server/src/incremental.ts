/**
 * IncrementalAnalyzer — 文件变更增量分析
 *
 * 使用 chokidar 监听项目文件变更，触发增量重新分析。
 * 文件变更后 emit GRAPH_UPDATED 事件，由 WebSocket 广播给客户端。
 */

import * as path from 'path'
import * as fs from 'fs'
import chokidar from 'chokidar'
import type { OmniDatabase } from '@omnivis/analyzer'
import { runAnalysis } from '@omnivis/analyzer'
import { omniVisEvents, EVENTS } from './events'

export interface IncrementalAnalyzerOptions {
  projectRoot: string
  dbPath: string
  db: OmniDatabase
  /** 要监听的目录（相对于 projectRoot） */
  watchDirs?: string[]
  /** 防抖延迟（毫秒） */
  debounceMs?: number
}

const DEFAULT_WATCH_DIRS = [
  'app',
  'src/app',
  'pages',
  'src/pages',
  'components',
  'src/components',
  'server',
  'src/server',
  'prisma',
]

export class IncrementalAnalyzer {
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private projectRoot: string
  private dbPath: string
  private debounceMs: number
  private watchDirs: string[]
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private isAnalyzing = false

  constructor(options: IncrementalAnalyzerOptions) {
    this.projectRoot = options.projectRoot
    this.dbPath = options.dbPath
    this.debounceMs = options.debounceMs ?? 1000
    this.watchDirs = options.watchDirs ?? DEFAULT_WATCH_DIRS
  }

  /**
   * 启动文件监听
   */
  start(): void {
    const dirsToWatch = this.watchDirs
      .map(dir => path.join(this.projectRoot, dir))
      .filter(dir => fs.existsSync(dir))

    if (dirsToWatch.length === 0) {
      console.warn('[IncrementalAnalyzer] No directories to watch')
      return
    }

    this.watcher = chokidar.watch(dirsToWatch, {
      ignored: [
        /(^|[\/\\])\../, // 忽略 dotfiles
        /node_modules/,
        /\.next/,
        /dist/,
        /\.omnivis/,
      ],
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher.on('change', (filePath) => this.onFileChange(filePath))
    this.watcher.on('add', (filePath) => this.onFileChange(filePath))
    this.watcher.on('unlink', (filePath) => this.onFileChange(filePath))

    console.log(`[IncrementalAnalyzer] Watching ${dirsToWatch.length} directories`)
  }

  /**
   * 文件变更处理（防抖）
   */
  private onFileChange(filePath: string): void {
    // 只处理 TS/JS/Prisma 文件
    if (!/\.(ts|tsx|js|jsx|prisma)$/.test(filePath)) return

    console.log(`[IncrementalAnalyzer] File changed: ${path.relative(this.projectRoot, filePath)}`)

    // 防抖：多次变更只触发一次分析
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.triggerAnalysis(filePath)
    }, this.debounceMs)
  }

  /**
   * 触发增量分析
   */
  private async triggerAnalysis(filePath: string): Promise<void> {
    if (this.isAnalyzing) {
      console.log('[IncrementalAnalyzer] Analysis already in progress, skipping')
      return
    }

    this.isAnalyzing = true
    omniVisEvents.emit(EVENTS.ANALYSIS_STARTED)

    try {
      console.log('[IncrementalAnalyzer] Running re-analysis...')
      await runAnalysis({
        projectRoot: this.projectRoot,
        dbPath: this.dbPath,
      })
      console.log('[IncrementalAnalyzer] Re-analysis complete')
      omniVisEvents.emit(EVENTS.GRAPH_UPDATED, filePath)
    } catch (err) {
      console.error('[IncrementalAnalyzer] Analysis failed:', err)
    } finally {
      this.isAnalyzing = false
    }
  }

  /**
   * 停止文件监听
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    console.log('[IncrementalAnalyzer] Stopped')
  }
}
