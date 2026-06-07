# Skill: MCP Server Development

> CodeOmniVis MCP Server 开发指南。基于 @modelcontextprotocol/sdk。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 实现或修改 MCP 工具（packages/mcp/）
- 调试 MCP 连接问题
- 添加新的 MCP 工具

## 技术栈

- **@modelcontextprotocol/sdk** — 官方 MCP SDK
- **better-sqlite3** — 直接查询本地数据库

## MCP Server 模板

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'codeomnivis', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

// 列出所有工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_api_routes',
      description: 'Get all API routes with their handler chain',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Route prefix filter' },
          includeDbCalls: { type: 'boolean', default: true },
        },
      },
    },
    // ... 其他工具
  ],
}))

// 调用工具
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'get_api_routes':
      return await handleGetApiRoutes(args)
    case 'get_component_tree':
      return await handleGetComponentTree(args)
    case 'find_callers':
      return await handleFindCallers(args)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
})

// 启动
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
```

## 工具实现模式

```typescript
import Database from 'better-sqlite3'

async function handleGetApiRoutes(args: unknown) {
  const { filter, includeDbCalls = true } = args as {
    filter?: string
    includeDbCalls?: boolean
  }

  const db = new Database('./codeomnivis.db', { readonly: true })

  try {
    // 查询所有 API 路由节点
    let query = `SELECT * FROM nodes WHERE type IN ('api_route', 'trpc_procedure', 'express_route')`
    const params: string[] = []

    if (filter) {
      query += ` AND json_extract(metadata, '$.route') LIKE ?`
      params.push(`${filter}%`)
    }

    const routes = db.prepare(query).all(...params)

    // 如果需要包含 DB 调用
    if (includeDbCalls) {
      for (const route of routes) {
        const dbCalls = db.prepare(`
          SELECT n.* FROM edges e
          JOIN nodes n ON e.target = n.id
          WHERE e.source = ? AND e.type = 'queries_db'
        `).all(route.id)
        ;(route as any).dbOperations = dbCalls
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ routes, totalCount: routes.length }, null, 2),
      }],
    }
  } finally {
    db.close()
  }
}
```

## 返回格式

```typescript
// 成功
return {
  content: [{
    type: 'text',
    text: JSON.stringify(result, null, 2),
  }],
}

// 错误
return {
  isError: true,
  content: [{
    type: 'text',
    text: `Error: ${error.message}`,
  }],
}
```

## 测试 MCP 工具

```bash
# stdio 模式测试
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node packages/mcp/dist/index.js

# 调用工具
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_api_routes","arguments":{}}}' | node packages/mcp/dist/index.js
```

## Cursor 配置

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

## Claude Desktop 配置

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```
