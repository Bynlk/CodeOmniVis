import { OmniDatabase, runFullAnalysis } from '@codeomnivis/analyzer'
import { getDbPath, hasDbCache } from '@codeomnivis/shared/node'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import {
  errorResponse,
  handleFindCallers,
  handleGetApiRoutes,
  handleGetComponentTree,
  handleGetDataFlow,
  handleListDbModels,
} from './tools'

export const MCP_TOOL_NAMES = {
  getApiRoutes: 'get_api_routes',
  getComponentTree: 'get_component_tree',
  findCallers: 'find_callers',
  listDbModels: 'list_db_models',
  getDataflow: 'get_dataflow',
} as const

export const PUBLIC_TOOL_NAMES = Object.freeze(Object.values(MCP_TOOL_NAMES))

const TOOL_DEFINITIONS = [
  {
    name: MCP_TOOL_NAMES.getApiRoutes,
    description: 'Get all API routes and their downstream database dependencies',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          description: 'Optional case-insensitive route or path filter',
        },
      },
    },
  },
  {
    name: MCP_TOOL_NAMES.getComponentTree,
    description: 'Get the component tree starting from a source path or route',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rootPath: { type: 'string', description: 'Component file path or route' },
        depth: { type: 'number', description: 'Maximum traversal depth; default 3' },
      },
      required: ['rootPath'],
    },
  },
  {
    name: MCP_TOOL_NAMES.findCallers,
    description: 'Find callers and affected pages for a node, route, or source path',
    inputSchema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', description: 'Node name, route, or source path' },
      },
      required: ['target'],
    },
  },
  {
    name: MCP_TOOL_NAMES.listDbModels,
    description: 'List database models discovered in the project',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: MCP_TOOL_NAMES.getDataflow,
    description: 'Trace data flow from database models through APIs to components',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: { type: 'string', description: 'Optional database model name' },
      },
    },
  },
]

export interface McpServerOptions {
  projectRoot: string
  log?: (message: string) => void
}

export interface McpServerRuntime {
  server: Server
  close: () => Promise<void>
}

export function createMcpServer(options: McpServerOptions): McpServerRuntime {
  const log = options.log ?? (() => {})
  const server = new Server(
    { name: 'codeomnivis', version: '0.0.1' },
    { capabilities: { tools: {} } },
  )
  let cachedDb: OmniDatabase | null = null
  let dbInitPromise: Promise<OmniDatabase> | null = null
  let closed = false

  async function getDb(): Promise<OmniDatabase> {
    if (cachedDb) return cachedDb
    if (dbInitPromise) return dbInitPromise

    dbInitPromise = (async () => {
      const dbPath = getDbPath(options.projectRoot)
      if (!hasDbCache(options.projectRoot)) {
        log('No cache found, running full analysis')
        await runFullAnalysis({ projectRoot: options.projectRoot, dbPath })
      }
      const db = new OmniDatabase(dbPath)
      await db.ready()
      cachedDb = db
      log('Database ready')
      return db
    })()

    try {
      return await dbInitPromise
    } catch (err) {
      dbInitPromise = null
      throw err
    }
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }))
  server.setRequestHandler(CallToolRequestSchema, async request => {
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

  return {
    server,
    close: async () => {
      if (closed) return
      closed = true
      await server.close()
      cachedDb?.close()
      cachedDb = null
      dbInitPromise = null
    },
  }
}
