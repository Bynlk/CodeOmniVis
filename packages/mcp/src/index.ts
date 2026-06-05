/**
 * @omnivis/mcp — MCP Server
 *
 * 提供 3 个工具供 AI 助手调用：
 * - getApiRoutes: 获取 API 路由列表
 * - getComponentTree: 获取组件树
 * - findCallers: 查找调用者
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { OmniDatabase, PrismaParser, GraphBuilder } from '@omnivis/analyzer'

// ============================================================
// MCP Server
// ============================================================

const server = new Server(
  {
    name: 'omnivis',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// 数据库实例
let db: OmniDatabase | null = null

// ============================================================
// 工具列表
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'getApiRoutes',
        description: 'Get all API routes and tRPC procedures in the project',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getComponentTree',
        description: 'Get the component tree structure',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'findCallers',
        description: 'Find all callers of a specific function or route',
        inputSchema: {
          type: 'object',
          properties: {
            targetId: {
              type: 'string',
              description: 'The ID of the node to find callers for',
            },
          },
          required: ['targetId'],
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

  // 确保数据库已初始化
  if (!db) {
    db = new OmniDatabase()
    await db.ready()
  }

  switch (name) {
    case 'getApiRoutes': {
      const apiRoutes = db.getNodesByType('api_route' as any)
      const trpcProcedures = db.getNodesByType('trpc_procedure' as any)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              apiRoutes: apiRoutes.map(n => ({
                id: n.id,
                name: n.name,
                filePath: n.filePath,
                metadata: n.metadata,
              })),
              trpcProcedures: trpcProcedures.map(n => ({
                id: n.id,
                name: n.name,
                filePath: n.filePath,
                metadata: n.metadata,
              })),
            }, null, 2),
          },
        ],
      }
    }

    case 'getComponentTree': {
      const components = db.getNodesByType('component' as any)
      const rendersEdges = db.getEdgesByType('renders' as any)

      // 构建组件树
      const tree = components.map(c => ({
        id: c.id,
        name: c.name,
        filePath: c.filePath,
        children: rendersEdges
          .filter(e => e.source === c.id)
          .map(e => e.target),
      }))

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tree, null, 2),
          },
        ],
      }
    }

    case 'findCallers': {
      const targetId = args?.targetId as string
      if (!targetId) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'targetId is required' }),
            },
          ],
        }
      }

      // 查找所有指向目标的边
      const inEdges = db.getInEdges(targetId)
      const callers = inEdges.map(e => ({
        source: e.source,
        type: e.type,
        confidence: e.confidence,
      }))

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ targetId, callers }, null, 2),
          },
        ],
      }
    }

    default:
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
      }
  }
})

// ============================================================
// 启动服务器
// ============================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('OmniVis MCP Server running on stdio')
}

main().catch(console.error)
