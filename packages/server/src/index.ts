/**
 * @omnivis/server — Web 服务入口
 *
 * 提供 REST API 和 WebSocket 服务。
 * 静态文件服务 UI 产物。
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import type { OmniGraph } from '@omnivis/shared'
import { OmniDatabase } from '@omnivis/analyzer'
import { createGraphRouter } from './routes/graph'

// ============================================================
// 类型定义
// ============================================================

export interface ServerOptions {
  port?: number
  host?: string
  dbPath?: string
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
    uiDistPath = path.resolve(__dirname, '../../ui/dist'),
    corsOrigin = '*',
  } = options

  // 初始化 Express
  const app = express()

  // 中间件
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json())

  // 初始化数据库
  const db = new OmniDatabase(dbPath)

  // API 路由
  const graphRouter = createGraphRouter(db)
  app.use('/api/graph', graphRouter)

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
  })

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
  function broadcastGraphUpdate(graph: OmniGraph): void {
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
  }

  // 启动服务器
  async function start(): Promise<void> {
    await db.ready()

    return new Promise((resolve) => {
      server.listen(port, host, () => {
        console.log(`OmniVis server running at http://${host}:${port}`)
        console.log(`WebSocket available at ws://${host}:${port}/ws`)
        resolve()
      })
    })
  }

  // 停止服务器
  async function stop(): Promise<void> {
    // 关闭所有 WebSocket 连接
    for (const client of clients) {
      client.close()
    }
    clients.clear()

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
