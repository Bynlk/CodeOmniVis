/**
 * @codeomnivis/server — Web 服务入口
 *
 * 提供 REST API 和 WebSocket 服务。
 * 静态文件服务 UI 产物。
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createServer as createHttpServer } from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import type { FreshnessStatus, ProjectMeta } from '@codeomnivis/shared'
import { isJsonObject } from '@codeomnivis/shared'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { createGraphRouter } from './routes/graph'
export { createGraphRouter } from './routes/graph'
import { createTestsRouter } from './routes/tests'
export { createTestsRouter } from './routes/tests'
import { codeomnivisEvents, EVENTS } from './events'
import { IncrementalAnalyzer } from './incremental'
import { registerAiRoutes } from './ai'
import {
  authenticateHeaders,
  createAccessGuard,
  createAccessPolicy,
  createSessionHandler,
  isLoopbackHost,
} from './accessGuard'
import { SessionStore } from './sessionStore'
export { isLoopbackHost, createMutatingGuard } from './authGuard'
import { isOriginAllowed, toOriginAllowlist } from './originGuard'
import { resolveProjectRootRequest } from './projectRootPolicy'

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================
// 类型定义
// ============================================================

export interface ServerOptions {
  port?: number
  host?: string
  dbPath?: string
  projectRoot?: string
  projectMeta?: ProjectMeta
  /** Detect complete metadata for a runtime project switch without reversing package dependencies. */
  detectProjectMeta?: (projectRoot: string) => Promise<ProjectMeta>
  uiDistPath?: string
  corsOrigin?: string | string[]
  /** Non-loopback REST, WebSocket and AI access token. */
  accessToken?: string
  /** HTTPS public origins must set Secure on browser session cookies. */
  secureCookies?: boolean
  /** Browser session absolute lifetime; defaults to 15 minutes. */
  sessionTtlMs?: number
  /** Maximum active in-memory browser sessions. */
  maxSessions?: number
}

export interface ServerInstance {
  app: express.Express
  server: ReturnType<typeof createHttpServer>
  db: OmniDatabase
  analyze: (onFilesCollected?: (count: number) => void) => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

// ============================================================
// 服务器创建
// ============================================================

export function createOmniServer(options: ServerOptions = {}): ServerInstance {
  const {
    port = 4321,
    host = 'localhost',
    dbPath = ':memory:',
    projectRoot = process.cwd(),
    projectMeta,
    detectProjectMeta,
    uiDistPath = path.resolve(__dirname, '../../ui/dist'),
    corsOrigin = `http://localhost:${port}`,
    accessToken,
    secureCookies,
    sessionTtlMs = 15 * 60 * 1_000,
    maxSessions = 128,
  } = options

  // 初始化 Express
  const app = express()

  // H8 · S-03:基础安全响应头。手写中间件,不引入额外依赖。
  // - 关闭 x-powered-by 指纹;nosniff 阻断 MIME 嗅探;DENY 阻断点击劫持;no-referrer 防 Referrer 泄露。
  app.disable('x-powered-by')
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-DNS-Prefetch-Control', 'off')
    next()
  })

  // 存储项目根路径供路由使用
  app.locals.projectRoot = path.resolve(projectRoot)
  app.locals.dbPath = dbPath

  // 中间件
  app.use(cors({ origin: corsOrigin, credentials: true }))
  app.use(express.json())

  // 初始化数据库
  const db = new OmniDatabase(dbPath)

  // 增量分析器
  const incrementalAnalyzer = new IncrementalAnalyzer({
    projectRoot,
    dbPath,
    db,
    projectMeta,
  })

  const sessions = new SessionStore({ ttlMs: sessionTtlMs, maxSessions })
  const accessPolicy = createAccessPolicy({
    host,
    accessToken,
    sessions,
    secureCookies:
      secureCookies ??
      (Array.isArray(corsOrigin)
        ? corsOrigin.some((origin) => origin.startsWith('https://'))
        : corsOrigin.startsWith('https://')),
  })
  const accessGuard = createAccessGuard(accessPolicy)
  const allowArbitraryAbsoluteProjectRoots = isLoopbackHost(host)

  // Browsers exchange the startup token once for a short-lived HttpOnly session.
  app.post('/api/session', createSessionHandler(accessPolicy))

  // API 路由
  const graphRouter = createGraphRouter(db, undefined, () => app.locals.projectRoot as string)
  app.use('/api/graph', accessGuard, graphRouter)
  app.use('/api/tests', accessGuard, createTestsRouter(db))

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // GET /api/status — 数据新鲜度
  app.get('/api/status', accessGuard, (_req, res) => {
    res.json({ data: incrementalAnalyzer.getStatus(), meta: {} })
  })

  // GET /api/project — UI 需要绝对项目根路径来解析节点的相对源码位置。
  app.get('/api/project', accessGuard, (_req, res) => {
    res.json({ data: { projectRoot: app.locals.projectRoot as string }, meta: {} })
  })

  // POST /api/analyze — 手动触发重新分析(兜底)
  // 与文件监听共用串行化逻辑,分析期间到达的变更不会丢失。
  app.post('/api/analyze', accessGuard, async (_req, res) => {
    try {
      await incrementalAnalyzer.refresh()
      res.json({ data: { success: true, status: incrementalAnalyzer.getStatus() }, meta: {} })
    } catch (err) {
      console.error('Analysis failed:', err)
      res.status(500).json({
        error: {
          code: 'ANALYSIS_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      })
    }
  })

  // POST /api/project — 运行时切换分析的项目根目录
  // body: { projectRoot: string }。校验目录存在,切换后重建图并重新分析。
  app.post('/api/project', accessGuard, async (req, res) => {
    const body: unknown = req.body
    const projectRootInput = isJsonObject(body) ? body.projectRoot : undefined
    if (typeof projectRootInput !== 'string' || projectRootInput.trim() === '') {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'projectRoot must be a non-empty string' },
      })
      return
    }

    // 本机绑定沿用本地工具信任模型；远程绑定继续约束在启动项目边界内。
    const boundaryRoot = path.resolve(projectRoot)
    const { ok, resolved } = resolveProjectRootRequest(
      boundaryRoot,
      projectRootInput.trim(),
      allowArbitraryAbsoluteProjectRoots,
    )
    if (!ok) {
      res.status(400).json({
        error: {
          code: 'PATH_TRAVERSAL',
          message: `projectRoot escapes the allowed boundary: ${boundaryRoot}`,
        },
      })
      return
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      res.status(400).json({
        error: { code: 'INVALID_PROJECT_ROOT', message: `Not an existing directory: ${resolved}` },
      })
      return
    }

    let targetProjectMeta: ProjectMeta | undefined
    try {
      targetProjectMeta = await detectProjectMeta?.(resolved)
    } catch (err) {
      console.error('Failed to detect target project metadata:', err)
      res.status(500).json({
        error: {
          code: 'PROJECT_DETECTION_FAILED',
          message: 'Failed to detect the target project structure',
        },
      })
      return
    }

    try {
      await incrementalAnalyzer.setProjectRoot(resolved, targetProjectMeta)
      app.locals.projectRoot = resolved
      res.json({
        data: { projectRoot: resolved, status: incrementalAnalyzer.getStatus() },
        meta: {},
      })
    } catch (err) {
      console.error('Failed to switch project root:', err)
      res.status(500).json({
        error: {
          code: 'PROJECT_SWITCH_FAILED',
          message: 'Failed to switch project',
        },
      })
    }
  })

  // POST /api/ai/chat、/api/ai/explain — AI 聊天/节点说明
  // 配置优先级:请求体 config > 环境变量 > 501。上游为用户自备 OpenAI 兼容 endpoint。
  registerAiRoutes(app, undefined, accessGuard, { allowLoopback: accessPolicy.loopback })

  // 静态文件服务（UI 产物）
  app.use(express.static(uiDistPath))

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDistPath, 'index.html'))
  })

  // HTTP 服务器
  const server = createHttpServer(app)

  // WebSocket 服务器
  // H4 · S-04:升级握手阶段校验 Origin,阻断跨站 WebSocket 劫持(CSWSH)。
  const wsOriginAllowlist = toOriginAllowlist(corsOrigin)
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info, done) => {
      const origin = info.origin
      if (!isOriginAllowed(origin, wsOriginAllowlist)) {
        console.warn(`WebSocket upgrade rejected: disallowed Origin "${origin ?? ''}"`)
        done(false, 403, 'Forbidden Origin')
        return
      }
      const decision = authenticateHeaders(info.req.headers, accessPolicy)
      if (!decision.ok) {
        console.warn(`WebSocket upgrade rejected: ${decision.code}`)
        done(false, decision.status, decision.code)
        return
      }
      done(true)
    },
  })

  // WebSocket 连接管理
  const clients = new Set<import('ws').WebSocket>()

  wss.on('connection', (ws) => {
    clients.add(ws)
    console.log(`WebSocket client connected. Total: ${clients.size}`)

    ws.on('close', () => {
      clients.delete(ws)
      console.log(`WebSocket client disconnected. Total: ${clients.size}`)
    })

    ws.on('error', (err) => {
      console.error('WebSocket error:', err)
      clients.delete(ws)
    })
  })

  // LEAK-02 · F11:ws 在 { server } 模式下会把底层 HTTP server 的 'error' 事件
  // 转发到 WebSocketServer 实例。若 wss 上没有 'error' 监听器,监听失败(如 EADDRINUSE)
  // 会以未处理 'error' 事件的形式直接 throw,使进程崩溃,且早于 start() 内的
  // server.once('error') 生效。这里挂一个 wss 级 error 处理器把错误交还给 server,
  // 由 start() 的 onError 统一 reject + 清理。
  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err)
  })

  // 广播图更新
  function broadcastGraphUpdate(): void {
    try {
      const graph = db.loadGraph()
      const message = JSON.stringify({
        type: 'graph_updated',
        payload: graph,
        timestamp: Date.now(),
      })

      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message)
        }
      }
    } catch (err) {
      console.error('Failed to broadcast graph update:', err)
    }
  }

  // 监听图更新事件，广播给所有 WebSocket 客户端。
  // LEAK-03 · F12:codeomnivisEvents 是模块级单例,多实例共享。必须保留本实例注册的
  // 监听器引用,stop() 时只 off() 这些引用,绝不能 removeAllListeners() 清空全局。
  const onGraphUpdated = (): void => {
    broadcastGraphUpdate()
  }
  codeomnivisEvents.on(EVENTS.GRAPH_UPDATED, onGraphUpdated)

  // 广播新鲜度状态变更
  function broadcastStatus(status: FreshnessStatus): void {
    const message = JSON.stringify({
      type: 'status_changed',
      payload: status,
      timestamp: Date.now(),
    })
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    }
  }

  const onStatusChanged = (status: FreshnessStatus): void => {
    broadcastStatus(status)
  }
  codeomnivisEvents.on(EVENTS.STATUS_CHANGED, onStatusChanged)

  // LEAK-02 · F11:start 状态机,防止重复启动并支撑监听失败时的 reject + cleanup。
  // 'idle' 未启动 → 'starting' 启动中 → 'listening' 已监听 → 'stopped' 已停止。
  let startState: 'idle' | 'starting' | 'listening' | 'stopped' = 'idle'

  // H9 · LEAK-01:进程退出钩子(start 注册 / stop 注销),保证 wss + DB + watcher 释放。
  let tearingDown = false
  const handleExit = (signal: NodeJS.Signals): void => {
    if (tearingDown) return
    tearingDown = true
    console.log(`Received ${signal}, releasing resources...`)
    void stop()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        console.error('Teardown failed:', err)
        process.exit(1)
      })
  }

  // 启动服务器
  async function start(): Promise<void> {
    // LEAK-02 · F11:防重复启动。非 idle 状态直接 reject,避免重复注册监听 / 退出钩子。
    if (startState !== 'idle') {
      throw new Error(`server.start() cannot run in state '${startState}'`)
    }
    startState = 'starting'

    await db.ready()

    // 启动文件监听
    incrementalAnalyzer.start()

    // H9 · LEAK-01:注册进程退出钩子,优雅释放 wss + DB + watcher。
    process.on('SIGINT', handleExit)
    process.on('SIGTERM', handleExit)

    return new Promise<void>((resolve, reject) => {
      // LEAK-02 · F11:监听失败(如 EADDRINUSE)时清理 start() 已获取的资源并 reject,
      // 避免 Promise 永久挂起与退出钩子 / watcher 泄漏。
      const onError = (err: Error): void => {
        server.removeListener('listening', onListening)
        process.removeListener('SIGINT', handleExit)
        process.removeListener('SIGTERM', handleExit)
        startState = 'stopped'
        // LEAK-02 · F11:先同步 reject,再异步清理 watcher。
        // 不能让 reject 依赖 incrementalAnalyzer.stop() 完成——若 watcher 关闭挂起,
        // Promise 将永久无法 settle。
        reject(err)
        void incrementalAnalyzer.stop().catch(() => {})
      }
      const onListening = (): void => {
        server.removeListener('error', onError)
        startState = 'listening'
        console.log(`CodeOmniVis server running at http://${host}:${port}`)
        console.log(`WebSocket available at ws://${host}:${port}/ws`)
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, host)
    })
  }

  // 供 CLI 首次分析复用与 REST refresh 相同的新鲜度状态机。
  async function analyze(onFilesCollected?: (count: number) => void): Promise<void> {
    await incrementalAnalyzer.refresh(onFilesCollected)
  }

  // 停止服务器
  async function stop(): Promise<void> {
    // H9:注销退出钩子,避免重复 stop 时累积监听器。
    process.removeListener('SIGINT', handleExit)
    process.removeListener('SIGTERM', handleExit)

    // 停止文件监听(等待 watcher 关闭)
    await incrementalAnalyzer.stop()

    // 关闭所有 WebSocket 连接
    for (const client of clients) {
      client.close()
    }
    clients.clear()

    // H9 · LEAK-01:关闭 WebSocketServer,释放底层监听器与升级钩子。
    await new Promise<void>((resolve) => {
      wss.close(() => resolve())
    })

    // 移除事件监听。LEAK-03 · F12:只注销本实例注册的监听器,
    // 不能 removeAllListeners() —— 那会连带删除其它实例 / 外部模块在同一单例上的订阅。
    codeomnivisEvents.off(EVENTS.GRAPH_UPDATED, onGraphUpdated)
    codeomnivisEvents.off(EVENTS.STATUS_CHANGED, onStatusChanged)

    // 关闭数据库
    db.close()
    sessions.dispose()

    const wasListening = startState === 'listening'
    startState = 'stopped'

    // 关闭服务器。LEAK-02 · F11:仅在曾经成功监听时才 close(),
    // 否则 server.close() 会抛 ERR_SERVER_NOT_RUNNING(start 失败后调用 stop 的场景)。
    if (!wasListening) {
      return
    }
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  return { app, server, db, analyze, start, stop }
}
