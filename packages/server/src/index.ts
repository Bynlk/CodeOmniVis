/**
 * @omnivis/server — Web 服务入口
 *
 * 提供 REST API 和 WebSocket 服务。
 * 静态文件服务 UI 产物。
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer } from 'ws'
import type { OmniGraph } from '@omnivis/shared'
import { OmniDatabase } from '@omnivis/analyzer'
import { createGraphRouter } from './routes/graph'
import { omniVisEvents, EVENTS } from './events'
import { IncrementalAnalyzer } from './incremental'

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

  // POST /api/analyze — 触发重新分析
  app.post('/api/analyze', async (req, res) => {
    try {
      omniVisEvents.emit(EVENTS.ANALYSIS_STARTED)

      // 动态导入分析器
      const analyzer = await import('@omnivis/analyzer')
      const fs = await import('fs')

      const builder = new analyzer.GraphBuilder(db)
      builder.registerParsers([
        new analyzer.PrismaParser(),
        new analyzer.NextjsAppParser(),
        new analyzer.NextjsPagesParser(),
        new analyzer.TrpcParser(),
        new analyzer.ExpressParser(),
        new analyzer.TypeormParser(),
        new analyzer.ApiCallsParser(),
        new analyzer.ReactComponentParser(),
        new analyzer.NestjsControllerParser(),
        new analyzer.NestjsModuleParser(),
        new analyzer.NestjsServiceParser(),
        new analyzer.DrizzleParser(),
      ])

      // 简单的文件扫描
      const files: string[] = []
      const scanDirs = ['app', 'src/app', 'pages', 'src/pages', 'components', 'src/components', 'server', 'src/server']

      function scanDir(dir: string): void {
        if (!fs.existsSync(dir)) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            scanDir(fullPath)
          } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            files.push(fullPath)
          }
        }
      }

      // 添加 Prisma schema
      const prismaPath = path.join(projectRoot, 'prisma', 'schema.prisma')
      if (fs.existsSync(prismaPath)) {
        files.push(prismaPath)
      }

      for (const dir of scanDirs) {
        scanDir(path.join(projectRoot, dir))
      }

      if (files.length > 0) {
        const projectMeta = {
          root: projectRoot,
          frontendFramework: 'next' as const,
          backendFramework: 'trpc' as const,
          databaseType: 'prisma' as const,
          monorepoType: 'none' as const,
          packages: [] as Array<{ name: string; path: string; dependencies: string[]; devDependencies: string[] }>,
          frontendDirs: [] as string[],
          backendDirs: [] as string[],
          trpcRouterPaths: [] as string[],
          prismaSchemaPath: path.join(projectRoot, 'prisma', 'schema.prisma'),
          typeormEntityDirs: [] as string[],
          tsConfigPath: null as string | null,
          buildFile: null as string | null,
        }

        await builder.parseFiles(files, {
          projectRoot,
          projectMeta,
          tsConfig: null,
          pathAliases: {},
        })
      }

      omniVisEvents.emit(EVENTS.GRAPH_UPDATED)
      res.json({ data: { success: true, message: 'Analysis completed', filesScanned: files.length }, meta: {} })
    } catch (err) {
      console.error('Analysis failed:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  // POST /api/ai/chat — AI 聊天（未实现）
  app.post('/api/ai/chat', (_req, res) => {
    res.status(501).json({
      error: 'AI chat not yet implemented',
      message: 'Connect your API key in settings to enable AI features',
    })
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
  omniVisEvents.on(EVENTS.GRAPH_UPDATED, () => {
    broadcastGraphUpdate()
  })

  // 启动服务器
  async function start(): Promise<void> {
    await db.ready()

    // 启动文件监听
    incrementalAnalyzer.start()

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
    // 停止文件监听
    incrementalAnalyzer.stop()

    // 关闭所有 WebSocket 连接
    for (const client of clients) {
      client.close()
    }
    clients.clear()

    // 移除事件监听
    omniVisEvents.removeAllListeners()

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
