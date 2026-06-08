/**
 * @codeomnivis/mcp — MCP Server
 *
 * 提供 5 个工具供 AI 助手调用：
 * - get_api_routes: 获取 API 路由列表及下游依赖
 * - get_component_tree: 获取组件树结构
 * - find_callers: 查找调用者及受影响页面
 * - list_db_models: 列出所有数据库模型
 * - get_dataflow: 追踪数据流（Model → API → Component）
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { OmniDatabase, runAnalysis, DataFlowTracer } from '@codeomnivis/analyzer'
import { getDbPath, hasDbCache } from '@codeomnivis/shared/node'
import type { NodeType, EdgeType } from '@codeomnivis/shared'

// ============================================================
// MCP Server
// ============================================================

const server = new Server(
  {
    name: 'codeomnivis',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// 项目根路径
const projectRoot = process.env.CODEOMNIVIS_PROJECT ?? process.cwd()

// 数据库实例缓存（避免每次调用都重新初始化）
let cachedDb: OmniDatabase | null = null
let dbInitPromise: Promise<OmniDatabase> | null = null

/**
 * 获取数据库实例（带缓存 + 并发保护）
 */
async function getDb(): Promise<OmniDatabase> {
  // 已缓存，直接返回
  if (cachedDb) return cachedDb

  // 正在初始化中，等待同一个 Promise（失败时清除，允许重试）
  if (dbInitPromise) {
    try {
      return await dbInitPromise
    } catch {
      // 之前的初始化失败了，清除并重试
      dbInitPromise = null
    }
  }

  // 创建初始化 Promise（并发调用共享同一个）
  dbInitPromise = (async () => {
    const dbPath = getDbPath(projectRoot)

    // 如果没有缓存，先运行分析
    if (!hasDbCache(projectRoot)) {
      log('No cache found, running analysis...')
      await runAnalysis({ projectRoot, dbPath })
    }

    // 创建数据库实例并缓存
    const db = new OmniDatabase(dbPath)
    await db.ready()
    cachedDb = db
    log('Database ready')
    return db
  })()

  return dbInitPromise
}

/**
 * 日志输出到 stderr（不干扰 stdio 协议）
 */
function log(message: string): void {
  process.stderr.write(`[codeomnivis-mcp] ${message}\n`)
}

/**
 * 安全提取字符串参数
 */
function stringArg(args: Record<string, unknown> | undefined, key: string): string | undefined {
  const val = args?.[key]
  return typeof val === 'string' ? val : undefined
}

/**
 * 安全提取数字参数
 */
function numberArg(args: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const val = args?.[key]
  if (typeof val === 'number' && !isNaN(val)) return val
  if (typeof val === 'string') {
    const parsed = Number(val)
    if (!isNaN(parsed)) return parsed
  }
  return fallback
}

// ============================================================
// 工具列表
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_api_routes',
        description: 'Get all API routes, tRPC procedures, and Express routes with their downstream dependencies (DB operations)',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Optional filter string to match route names or paths (case-insensitive)',
            },
          },
        },
      },
      {
        name: 'get_component_tree',
        description: 'Get the component tree structure starting from a root path or route',
        inputSchema: {
          type: 'object',
          properties: {
            rootPath: {
              type: 'string',
              description: 'Root component file path or route (e.g. "/booking" or "components/BookingList.tsx")',
            },
            depth: {
              type: 'number',
              description: 'Maximum depth to traverse (default: 3)',
            },
          },
          required: ['rootPath'],
        },
      },
      {
        name: 'find_callers',
        description: 'Find all callers and affected frontend pages for a specific node (by name, route, or file path)',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'The name, route, or file path of the node to find callers for (e.g. "User" or "/api/booking")',
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'list_db_models',
        description: 'List all database models (Prisma/TypeORM/Drizzle) in the project',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_dataflow',
        description: 'Trace data flow from a database model through API to frontend components',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'The model name to trace (e.g. "User"). If omitted, returns overview of all models.',
            },
          },
        },
      },
    ],
  }
})

// ============================================================
// 工具调用
// ============================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const db = await getDb()

    switch (name) {
      case 'get_api_routes':
        return handleGetApiRoutes(db, args)
      case 'get_component_tree':
        return handleGetComponentTree(db, args)
      case 'find_callers':
        return handleFindCallers(db, args)
      case 'list_db_models':
        return handleListDbModels(db)
      case 'get_dataflow':
        return handleGetDataFlow(db, args)
      default:
        return errorResponse(`Unknown tool: ${name}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`Tool "${name}" failed: ${message}`)
    return errorResponse(message)
  }
})

// ============================================================
// 工具实现
// ============================================================

function handleGetApiRoutes(db: OmniDatabase, args: Record<string, unknown> | undefined) {
  const filter = stringArg(args, 'filter')?.toLowerCase()
  const apiNodes = db.getNodesByTypes(['api_route', 'trpc_procedure', 'express_route'] as NodeType[])

  const filtered = filter
    ? apiNodes.filter(n => {
        if (n.name.toLowerCase().includes(filter)) return true
        const route = (n.metadata as Record<string, unknown>)?.route
        return typeof route === 'string' && route.toLowerCase().includes(filter)
      })
    : apiNodes

  const result = filtered.map(node => {
    const downstream = db.getDownstreamNodes(node.id, ['handles', 'calls_service', 'queries_db'] as EdgeType[])
    const callers = db.getUpstreamNodes(node.id, ['calls_api'] as EdgeType[])
    return {
      id: node.id,
      method: (node.metadata as Record<string, unknown>)?.method ?? 'UNKNOWN',
      path: (node.metadata as Record<string, unknown>)?.route ?? node.name,
      file: node.filePath,
      line: node.line,
      calledBy: callers.map(c => ({ id: c.id, name: c.name, type: c.type })),
      dbOperations: downstream
        .filter(d => d.type === 'db_model')
        .map(d => ({ model: d.name, file: d.filePath })),
    }
  })

  return success({ routes: result, totalCount: result.length })
}

function handleGetComponentTree(db: OmniDatabase, args: Record<string, unknown> | undefined) {
  const rootPath = stringArg(args, 'rootPath')
  if (!rootPath) {
    return errorResponse('rootPath is required')
  }

  const depth = numberArg(args, 'depth', 3)
  const rootNode = db.findNodeByRoute(rootPath) ?? db.findNodeByFilePath(rootPath)

  if (!rootNode) {
    return success({
      error: `No node found for: ${rootPath}`,
      suggestion: 'Try with a file path like "app/booking/page.tsx" or a route like "/booking"',
    })
  }

  const tree = db.getSubtree(rootNode.id, 'renders' as EdgeType, depth)
  if (!tree || Object.keys(tree).length === 0) {
    return success({ root: rootNode.name, children: [], message: 'No child components found' })
  }

  return success(tree)
}

function handleFindCallers(db: OmniDatabase, args: Record<string, unknown> | undefined) {
  const target = stringArg(args, 'target')
  if (!target) {
    return errorResponse('target is required')
  }

  const targetNode = db.findNodeByAny(target)
  if (!targetNode) {
    return success({
      error: `Not found: ${target}`,
      suggestion: 'Try with a model name like "User" or a route like "/api/booking"',
    })
  }

  const callers = db.getUpstreamNodes(targetNode.id, ['calls_api', 'handles', 'calls_service', 'queries_db'] as EdgeType[])
  const affectedPages = db.getAffectedPages(targetNode.id)

  return success({
    target: targetNode.name,
    targetType: targetNode.type,
    file: targetNode.filePath,
    callers: callers.map(c => ({
      id: c.id,
      type: c.type,
      name: c.name,
      file: c.filePath,
    })),
    affectedFrontendPages: affectedPages.map(p => ({
      name: p.name,
      route: (p.metadata as Record<string, unknown>)?.route ?? p.name,
      file: p.filePath,
    })),
  })
}

function handleListDbModels(db: OmniDatabase) {
  const models = db.getNodesByType('db_model' as NodeType)
  return success({
    models: models.map(m => ({
      id: m.id,
      name: m.name,
      file: m.filePath,
      tableName: (m.metadata as Record<string, unknown>)?.tableName,
      fieldCount: (m.metadata as Record<string, unknown>)?.fieldCount,
    })),
    totalCount: models.length,
  })
}

function handleGetDataFlow(db: OmniDatabase, args: Record<string, unknown> | undefined) {
  const graph = db.loadGraph()
  const tracer = new DataFlowTracer(graph)
  const modelName = stringArg(args, 'model')

  if (modelName) {
    const modelNode = graph.nodes.find(
      n => n.type === 'db_model' && n.name.toLowerCase() === modelName.toLowerCase()
    )
    if (!modelNode) {
      return success({
        error: `Model not found: ${modelName}`,
        availableModels: graph.nodes.filter(n => n.type === 'db_model').map(n => n.name),
      })
    }

    const path = tracer.traceModelFlow(modelNode)
    return success({
      model: modelNode.name,
      routes: path.apiNodes.map(n => ({ name: n.name, file: n.filePath })),
      components: path.componentNodes.map(n => ({ name: n.name, file: n.filePath })),
      summary: `${modelNode.name} → ${path.apiNodes.length} routes → ${path.componentNodes.length} components`,
    })
  }

  const results = tracer.traceAllModels()
  return success({
    models: results.map(r => ({
      name: r.modelName,
      routes: r.totalRoutes,
      components: r.totalComponents,
      summary: `${r.modelName} → ${r.totalRoutes} routes → ${r.totalComponents} components`,
    })),
    totalCount: results.length,
  })
}

// ============================================================
// 辅助函数
// ============================================================

function success(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

function errorResponse(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}

// ============================================================
// 启动服务器
// ============================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  log('MCP Server running on stdio')
}

main().catch((err) => {
  log(`Fatal: ${err}`)
  process.exit(1)
})

// 优雅关闭：持久化数据库
process.on('SIGINT', () => {
  if (cachedDb) {
    cachedDb.close()
    cachedDb = null
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  if (cachedDb) {
    cachedDb.close()
    cachedDb = null
  }
  process.exit(0)
})
