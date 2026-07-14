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
import { pathToFileURL } from 'url'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { OmniDatabase, runFullAnalysis, DataFlowTracer } from '@codeomnivis/analyzer'
import { getDbPath, hasDbCache } from '@codeomnivis/shared/node'
import type { NodeType, EdgeType, OmniNode } from '@codeomnivis/shared'
import { isNodeOfType, isJsonObject } from '@codeomnivis/shared'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { MCP_TOOL_NAMES } from './server'

export { MCP_TOOL_NAMES, PUBLIC_TOOL_NAMES } from './server'

const API_NODE_TYPES: NodeType[] = ['api_route', 'trpc_procedure', 'express_route', 'tsrpc_api', 'tsrpc_service']
const API_DOWNSTREAM_EDGE_TYPES: EdgeType[] = ['handles', 'calls_service', 'queries_db']
const API_CALLER_EDGE_TYPES: EdgeType[] = ['calls_api']
const CALL_CHAIN_EDGE_TYPES: EdgeType[] = ['calls_api', 'handles', 'calls_service', 'queries_db']
const RENDERS_EDGE_TYPE: EdgeType = 'renders'
const DB_MODEL_NODE_TYPE: NodeType = 'db_model'

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

    // 如果没有缓存，先运行完整分析（与 CLI serve 一致）
    if (!hasDbCache(projectRoot)) {
      log('No cache found, running full analysis...')
      await runFullAnalysis({ projectRoot, dbPath })
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
function stringArg(args: unknown, key: string): string | undefined {
  if (!isJsonObject(args)) return undefined
  const val = args[key]
  return typeof val === 'string' ? val : undefined
}

/** get_component_tree depth 的硬上限,与 analyzer getSubtree 的兜底一致。 */
const MAX_COMPONENT_TREE_DEPTH = 100

type DepthResult = { ok: true; value: number } | { ok: false; message: string }

/**
 * BOUND-04:严格校验 depth 参数。
 * 仅接受省略(用默认)或有限的非负整数(含数字字符串)。
 * 拒绝 Infinity / NaN / 负数 / 非整数 / 超上限,返回错误信息交由 caller 转 MCP error。
 */
export function validateDepth(args: unknown, fallback: number): DepthResult {
  const raw = isJsonObject(args) ? args['depth'] : undefined
  if (raw === undefined || raw === null) return { ok: true, value: fallback }

  let n: number
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    n = Number(raw)
  } else {
    return { ok: false, message: `depth must be a non-negative integer, got: ${JSON.stringify(raw)}` }
  }

  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, message: `depth must be a finite integer, got: ${JSON.stringify(raw)}` }
  }
  if (n < 0) {
    return { ok: false, message: `depth must be >= 0, got: ${n}` }
  }
  if (n > MAX_COMPONENT_TREE_DEPTH) {
    return { ok: false, message: `depth exceeds maximum ${MAX_COMPONENT_TREE_DEPTH}, got: ${n}` }
  }
  return { ok: true, value: n }
}

function getRouteDisplay(node: OmniNode): { method: string; path: string } {
  if (isNodeOfType(node, 'api_route')) {
    return { method: node.metadata.method, path: node.metadata.route }
  }
  if (isNodeOfType(node, 'express_route')) {
    return { method: node.metadata.method, path: node.metadata.route }
  }
  if (isNodeOfType(node, 'trpc_procedure')) {
    return { method: node.metadata.procedureType.toUpperCase(), path: node.name }
  }
  if (isNodeOfType(node, 'tsrpc_api')) {
    return { method: node.metadata.transport.toUpperCase(), path: node.metadata.apiPath }
  }
  if (isNodeOfType(node, 'tsrpc_service')) {
    return { method: node.metadata.transport.toUpperCase(), path: node.metadata.servicePath }
  }
  return { method: 'UNKNOWN', path: node.name }
}

function getNodeRoute(node: OmniNode): string {
  if (isNodeOfType(node, 'page')) return node.metadata.route
  if (isNodeOfType(node, 'api_route')) return node.metadata.route
  if (isNodeOfType(node, 'express_route')) return node.metadata.route
  return node.name
}

// ============================================================
// 工具列表
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: MCP_TOOL_NAMES.getApiRoutes,
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
        name: MCP_TOOL_NAMES.getComponentTree,
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
        name: MCP_TOOL_NAMES.findCallers,
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
        name: MCP_TOOL_NAMES.listDbModels,
        description: 'List all database models (Prisma/TypeORM/Drizzle) in the project',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: MCP_TOOL_NAMES.getDataflow,
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
      case MCP_TOOL_NAMES.getApiRoutes:
        return handleGetApiRoutes(db, args)
      case MCP_TOOL_NAMES.getComponentTree:
        return handleGetComponentTree(db, args)
      case MCP_TOOL_NAMES.findCallers:
        return handleFindCallers(db, args)
      case MCP_TOOL_NAMES.listDbModels:
        return handleListDbModels(db)
      case MCP_TOOL_NAMES.getDataflow:
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

export function handleGetApiRoutes(db: OmniDatabase, args: unknown) {
  const filter = stringArg(args, 'filter')?.toLowerCase()
  const apiNodes = db.getNodesByTypes(API_NODE_TYPES)

  const filtered = filter
    ? apiNodes.filter(n => {
        if (n.name.toLowerCase().includes(filter)) return true
        const { path } = getRouteDisplay(n)
        return path.toLowerCase().includes(filter)
      })
    : apiNodes

  const result = filtered.map(node => {
    const { method, path } = getRouteDisplay(node)
    const downstream = db.getDownstreamNodes(node.id, API_DOWNSTREAM_EDGE_TYPES)
    const callers = db.getUpstreamNodes(node.id, API_CALLER_EDGE_TYPES)
    return {
      id: node.id,
      method,
      path,
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

export function handleGetComponentTree(db: OmniDatabase, args: unknown) {
  const rootPath = stringArg(args, 'rootPath')
  if (!rootPath) {
    return errorResponse('rootPath is required')
  }

  const depthResult = validateDepth(args, 3)
  if (!depthResult.ok) {
    return errorResponse(depthResult.message)
  }
  const depth = depthResult.value
  const rootNode = db.findNodeByRoute(rootPath) ?? db.findNodeByFilePath(rootPath)

  if (!rootNode) {
    return success({
      error: `No node found for: ${rootPath}`,
      suggestion: 'Try with a file path like "app/booking/page.tsx" or a route like "/booking"',
    })
  }

  const tree = db.getSubtree(rootNode.id, RENDERS_EDGE_TYPE, depth)
  if (tree === null) {
    return success({
      error: `No node found for: ${rootPath}`,
      suggestion: 'Try with a file path like "app/booking/page.tsx" or a route like "/booking"',
    })
  }
  if (tree.children.length === 0) {
    return success({ root: rootNode.name, children: [], message: 'No child components found' })
  }

  return success(tree)
}

export function handleFindCallers(db: OmniDatabase, args: unknown) {
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

  const callers = db.getUpstreamNodes(targetNode.id, CALL_CHAIN_EDGE_TYPES)
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
      route: getNodeRoute(p),
      file: p.filePath,
    })),
  })
}

export function handleListDbModels(db: OmniDatabase) {
  const models = db.getNodesByType(DB_MODEL_NODE_TYPE)
  return success({
    models: models.map(m => ({
      id: m.id,
      name: m.name,
      file: m.filePath,
      tableName: isNodeOfType(m, 'db_model') ? m.metadata.tableName : m.name,
      fieldCount: isNodeOfType(m, 'db_model') ? m.metadata.fieldCount : 0,
    })),
    totalCount: models.length,
  })
}

export function handleGetDataFlow(db: OmniDatabase, args: unknown) {
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

function success(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

function errorResponse(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
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

// 仅当本模块作为入口直接运行时才启动 stdio server 与注册信号处理器,
// 以便测试可安全 import 真实 handler 而不触发 transport / 进程退出钩子。
const isMainModule = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(entry).href
  } catch {
    return false
  }
})()

if (isMainModule) {
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
}
