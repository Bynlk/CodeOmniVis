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
import { WebSocketServer } from 'ws'
import type { FreshnessStatus } from '@codeomnivis/shared'
import { isJsonObject } from '@codeomnivis/shared'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { createGraphRouter } from './routes/graph'
import { codeomnivisEvents, EVENTS } from './events'
import { IncrementalAnalyzer } from './incremental'
import { registerAiRoutes } from './ai'

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
  uiDistPath?: string
  corsOrigin?: string | string[]
}

export interface ServerInstance {
  app: express.Express
  server: ReturnType<typeof createHttpServer>
  db: OmniDatabase
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
    uiDistPath = path.resolve(__dirname, '../../ui/dist'),
    corsOrigin = `http://localhost:${port}`,
  } = options

  // 初始化 Express
  const app = express()

  // 存储项目根路径供路由使用
  app.locals.projectRoot = projectRoot
  app.locals.dbPath = dbPath

  // 中间件
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json())

  // 初始化数据库
  const db = new OmniDatabase(dbPath)

  // 增量分析器
  const incrementalAnalyzer = new IncrementalAnalyzer({
    projectRoot,
    dbPath,
    db,
  })

  // API 路由
  const graphRouter = createGraphRouter(db)
  app.use('/api/graph', graphRouter)

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // GET /api/status — 数据新鲜度
  app.get('/api/status', (_req, res) => {
    res.json({ data: incrementalAnalyzer.getStatus(), meta: {} })
  })

  // POST /api/analyze — 手动触发重新分析(兜底)
  // 与文件监听共用串行化逻辑,分析期间到达的变更不会丢失。
  app.post('/api/analyze', async (_req, res) => {
    try {
      await incrementalAnalyzer.refresh()
      res.json({ data: { success: true, status: incrementalAnalyzer.getStatus() }, meta: {} })
    } catch (err) {
      console.error('Analysis failed:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  // POST /api/project — 运行时切换分析的项目根目录
  // body: { projectRoot: string }。校验目录存在,切换后重建图并重新分析。
  app.post('/api/project', async (req, res) => {
    const body: unknown = req.body
    const projectRootInput = isJsonObject(body) ? body.projectRoot : undefined
    if (typeof projectRootInput !== 'string' || projectRootInput.trim() === '') {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'projectRoot must be a non-empty string' },
      })
      return
    }

    const resolved = path.resolve(projectRootInput)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      res.status(400).json({
        error: { code: 'INVALID_PROJECT_ROOT', message: `Not an existing directory: ${resolved}` },
      })
      return
    }

    try {
      await incrementalAnalyzer.setProjectRoot(resolved)
      app.locals.projectRoot = resolved
      res.json({
        data: { projectRoot: resolved, status: incrementalAnalyzer.getStatus() },
        meta: {},
      })
    } catch (err) {
      console.error('Failed to switch project root:', err)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } })
    }
  })

  // POST /api/ai/chat、/api/ai/explain — AI 聊天/节点说明
  // 配置优先级:请求体 config > 环境变量 > 501。上游为用户自备 OpenAI 兼容 endpoint。
  registerAiRoutes(app)

  // 静态文件服务（UI 产物）
  app.use(express.static(uiDistPath))

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(uiDistPath, 'index.html'))
  })

  // HTTP 服务器
  const server = createHttpServer(app)

  // WebSocket 服务器
  const wss = new WebSocketServer({ server, path: '/ws' })

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
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message)
        }
      }
    } catch (err) {
      console.error('Failed to broadcast graph update:', err)
    }
  }

  // 监听图更新事件，广播给所有 WebSocket 客户端
  codeomnivisEvents.on(EVENTS.GRAPH_UPDATED, () => {
    broadcastGraphUpdate()
  })

  // 广播新鲜度状态变更
  function broadcastStatus(status: FreshnessStatus): void {
    const message = JSON.stringify({
      type: 'status_changed',
      payload: status,
      timestamp: Date.now(),
    })
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(message)
      }
    }
  }

  codeomnivisEvents.on(EVENTS.STATUS_CHANGED, (status: FreshnessStatus) => {
    broadcastStatus(status)
  })

  // 启动服务器
  async function start(): Promise<void> {
    await db.ready()

    // 启动文件监听
    incrementalAnalyzer.start()

    return new Promise((resolve) => {
      server.listen(port, host, () => {
        console.log(`CodeOmniVis server running at http://${host}:${port}`)
        console.log(`WebSocket available at ws://${host}:${port}/ws`)
        resolve()
      })
    })
  }

  // 停止服务器
  async function stop(): Promise<void> {
    // 停止文件监听
    incrementalAnalyzer.stop()

    // 关闭所有 WebSocket 连接
    for (const client of clients) {
      client.close()
    }
    clients.clear()

    // 移除事件监听
    codeomnivisEvents.removeAllListeners()

    // 关闭数据库
    db.close()

    // 关闭服务器
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  return { app, server, db, start, stop }
}
