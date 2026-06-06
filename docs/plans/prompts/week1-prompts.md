# 第一周 Claude Code Prompts

> 修复四个严重 Bug：MCP 返回空数据、UI Panel 崩溃、WebSocket 未触发、端点 404

---

## Prompt 1-A：数据库路径共享

```
你是 OmniVis 项目的开发者。按顺序执行：

1. 读取 packages/shared/src/types/ 目录结构
2. 读取 packages/analyzer/src/storage/db.ts 完整内容
3. 读取 packages/cli/src/commands/serve.ts 完整内容

4. 创建 packages/shared/src/utils/dbPath.ts：

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'

/**
 * 根据项目根路径生成唯一的 SQLite 文件路径
 * 存放在 ~/.omnivis/projects/{hash}.db
 * 同一个项目无论从哪里调用，总是得到同一个路径
 */
export function getDbPath(projectRoot: string): string {
  const absRoot = path.resolve(projectRoot)
  const hash = crypto
    .createHash('md5')
    .update(absRoot)
    .digest('hex')
    .slice(0, 12)

  const dir = path.join(os.homedir(), '.omnivis', 'projects')
  fs.mkdirSync(dir, { recursive: true })

  return path.join(dir, `${hash}.db`)
}

/**
 * 检查项目是否已有分析缓存
 */
export function hasDbCache(projectRoot: string): boolean {
  return fs.existsSync(getDbPath(projectRoot))
}

/**
 * 删除项目缓存（用于 omnivis init --clean）
 */
export function clearDbCache(projectRoot: string): void {
  const p = getDbPath(projectRoot)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

5. 修改 packages/shared/src/index.ts，导出 dbPath.ts 的内容

6. 修改 OmniDatabase 构造函数，移除 :memory: 默认值，
   参数改为必填：constructor(dbPath: string)

7. 修改 serve.ts、analyze.ts、check.ts、mcp.ts，
   在命令 action 内：
   const projectRoot = path.resolve(options.project ?? '.')
   const dbPath = getDbPath(projectRoot)
   const db = new OmniDatabase(dbPath)

8. 运行 pnpm build 确认无 TypeScript 错误
```

---

## Prompt 1-B：MCP 工具实现

```
你是 OmniVis 项目的开发者。
Prompt 1-A 已完成（数据库路径共享）。

1. 读取 packages/mcp/src/index.ts 完整内容
2. 读取 packages/analyzer/src/storage/db.ts 完整内容

3. 在 OmniDatabase 类中新增以下方法：

getNodesByType(types: NodeType[]): OmniNode[] {
  const placeholders = types.map(() => '?').join(',')
  const rows = this.db.prepare(
    `SELECT * FROM nodes WHERE type IN (${placeholders})`
  ).all(...types) as any[]
  return rows.map(this.rowToNode)
}

getDownstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
  const edgeFilter = edgeTypes
    ? `AND e.type IN (${edgeTypes.map(() => '?').join(',')})`
    : ''
  const rows = this.db.prepare(`
    SELECT n.* FROM nodes n
    JOIN edges e ON e.target = n.id
    WHERE e.source = ? ${edgeFilter}
  `).all(nodeId, ...(edgeTypes ?? [])) as any[]
  return rows.map(this.rowToNode)
}

getUpstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
  const edgeFilter = edgeTypes
    ? `AND e.type IN (${edgeTypes.map(() => '?').join(',')})`
    : ''
  const rows = this.db.prepare(`
    SELECT n.* FROM nodes n
    JOIN edges e ON e.source = n.id
    WHERE e.target = ? ${edgeFilter}
  `).all(nodeId, ...(edgeTypes ?? [])) as any[]
  return rows.map(this.rowToNode)
}

findNodeByRoute(route: string): OmniNode | null {
  const row = this.db.prepare(
    `SELECT * FROM nodes WHERE json_extract(metadata, '$.route') = ? LIMIT 1`
  ).get(route) as any
  return row ? this.rowToNode(row) : null
}

findNodeByAny(query: string): OmniNode | null {
  return this.findNodeByRoute(query)
    ?? this.db.prepare(`SELECT * FROM nodes WHERE name = ? LIMIT 1`)
         .get(query) as any
    ?? null
}

getAffectedPages(nodeId: string, maxDepth = 10): OmniNode[] {
  const visited = new Set<string>()
  const queue = [nodeId]
  const pages: OmniNode[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const upstreams = this.getUpstreamNodes(current)
    for (const up of upstreams) {
      if (up.type === 'page') pages.push(up)
      else queue.push(up.id)
    }
  }
  return pages
}

getSubtree(rootId: string, edgeType: EdgeType, maxDepth: number): object {
  const root = this.getNode(rootId)
  if (!root || maxDepth === 0) return {}

  const children = this.getDownstreamNodes(rootId, [edgeType])
  return {
    id: root.id,
    name: root.name,
    type: root.type,
    children: children.map(c => this.getSubtree(c.id, edgeType, maxDepth - 1)),
  }
}

4. 重写 packages/mcp/src/index.ts：

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { OmniDatabase } from '@omnivis/analyzer'
import { getDbPath, hasDbCache } from '@omnivis/shared'
import { runAnalysis } from '../../../analyzer/src/index'
import * as path from 'path'

const projectRoot = process.env.OMNIVIS_PROJECT ?? process.cwd()
const dbPath = getDbPath(projectRoot)

async function ensureDbReady(): Promise<OmniDatabase> {
  if (!hasDbCache(projectRoot)) {
    console.error('[omnivis-mcp] No cache found, running analysis...')
    await runAnalysis({ projectRoot, dbPath })
  }
  return new OmniDatabase(dbPath)
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const db = await ensureDbReady()

  if (req.params.name === 'get_api_routes') {
    const filter = req.params.arguments?.filter as string | undefined
    const apiNodes = db.getNodesByType(['api_route', 'trpc_procedure', 'express_route'])
    const filtered = filter
      ? apiNodes.filter(n => n.name.includes(filter) ||
          (n.metadata as any)?.route?.includes(filter))
      : apiNodes

    const result = filtered.map(node => {
      const downstream = db.getDownstreamNodes(node.id, ['handles', 'calls_service', 'queries_db'])
      const callers = db.getUpstreamNodes(node.id, ['calls_api'])
      return {
        id: node.id,
        method: (node.metadata as any)?.method ?? 'UNKNOWN',
        path: (node.metadata as any)?.route ?? node.name,
        file: node.filePath,
        line: node.line,
        calledBy: callers.map(c => c.id),
        dbOperations: downstream
          .filter(n => n.type === 'db_model')
          .map(n => ({ model: n.name, file: n.filePath })),
      }
    })

    return {
      content: [{ type: 'text', text: JSON.stringify({ routes: result, totalCount: result.length }, null, 2) }]
    }
  }

  if (req.params.name === 'get_component_tree') {
    const rootPath = req.params.arguments?.rootPath as string
    const depth = (req.params.arguments?.depth as number) ?? 3
    const rootNode = db.findNodeByRoute(rootPath) ?? db.findNodeByFilePath(rootPath)
    if (!rootNode) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: `No node found for: ${rootPath}` }) }] }
    }
    const tree = db.getSubtree(rootNode.id, 'renders', depth)
    return { content: [{ type: 'text', text: JSON.stringify(tree, null, 2) }] }
  }

  if (req.params.name === 'find_callers') {
    const target = req.params.arguments?.target as string
    const targetNode = db.findNodeByAny(target)
    if (!targetNode) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: `Not found: ${target}` }) }] }
    }
    const callers = db.getUpstreamNodes(targetNode.id, undefined)
    const affectedPages = db.getAffectedPages(targetNode.id)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          target: targetNode.name,
          targetType: targetNode.type,
          callers: callers.map(c => ({ id: c.id, type: c.type, name: c.name, file: c.filePath })),
          affectedFrontendPages: affectedPages.map(p => (p.metadata as any)?.route ?? p.name),
        }, null, 2)
      }]
    }
  }

  throw new Error(`Unknown tool: ${req.params.name}`)
})

5. 运行 pnpm build，确认无错误

6. 手动测试（需要先运行 omnivis serve 分析项目）：
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_api_routes","arguments":{}},"id":1}' | npx omnivis mcp --stdio

   输出应包含实际的路由数据，不是空数组。
```

---

## Prompt 1-C：UI Panel 修复 + WebSocket + 端点修复

```
你是 OmniVis 项目的开发者。

1. 读取 packages/ui/src/components/TabBar/IssuesPanel.tsx 完整内容
2. 读取 packages/ui/src/components/TabBar/StatsPanel.tsx 完整内容
3. 读取 packages/server/src/index.ts 完整内容
4. 读取 packages/server/src/routes/ 目录下所有文件

5. 修复 IssuesPanel：queryFn 的返回值改为 json.data
   // 修改前（错误）
   const { data: issues } = useQuery({
     queryKey: ['issues'],
     queryFn: async () => {
       const res = await fetch('/api/issues')
       return res.json()
     }
   })

   // 修改后
   const { data: issues } = useQuery({
     queryKey: ['issues'],
     queryFn: async () => {
       const res = await fetch('/api/issues')
       const json = await res.json()
       return json.data as Issue[]
     }
   })

6. 修复 StatsPanel：queryFn 改为 json.data，所有 stats.xxx 改为 stats?.xxx ?? '—'

7. 创建 packages/server/src/events.ts：

   import { EventEmitter } from 'events'
   export const omniVisEvents = new EventEmitter()
   export const EVENTS = {
     GRAPH_UPDATED: 'graph:updated',
     ANALYSIS_STARTED: 'analysis:started',
     ANALYSIS_COMPLETED: 'analysis:completed',
   } as const

8. 修改 server/src/index.ts，监听 omniVisEvents.on(EVENTS.GRAPH_UPDATED)，
   触发时向所有 WebSocket 客户端广播

9. 修改 IncrementalAnalyzer（chokidar watcher），在文件变更重新分析后，
   调用 omniVisEvents.emit(EVENTS.GRAPH_UPDATED, filePath)

10. 新增 POST /api/analyze 路由：

    router.post('/analyze', async (req, res) => {
      try {
        const projectRoot = req.app.locals.projectRoot as string
        omniVisEvents.emit(EVENTS.ANALYSIS_STARTED)
        await runAnalysis({ projectRoot, dbPath: getDbPath(projectRoot) })
        omniVisEvents.emit(EVENTS.GRAPH_UPDATED)
        res.json({ data: { success: true, message: 'Analysis completed' }, meta: {} })
      } catch (err) {
        res.status(500).json({ error: String(err) })
      }
    })

11. 新增 POST /api/ai/chat 路由（返回 501）：

    router.post('/ai/chat', (req, res) => {
      res.status(501).json({
        error: 'AI chat not yet implemented',
        message: 'Connect your API key in settings to enable AI features'
      })
    })

12. 运行 pnpm build，确认无错误
```
