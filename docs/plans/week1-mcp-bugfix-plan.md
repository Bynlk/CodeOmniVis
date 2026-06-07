# 第一周计划书：修复四个严重 Bug

> 目标：MCP 真正可用、UI 不崩溃、实时更新生效
> 完成后可以说："在 Cursor 里查询整个架构" 这句话变成真的

---

## Bug 总览

| # | Bug | 现象 | 根因 |
|---|-----|------|------|
| 1 | MCP 返回空数据 | Cursor 里调用工具全部返回 `[]` | DB 用 `:memory:`，分析结果从未写入 |
| 2 | IssuesPanel/StatsPanel 崩溃 | UI 打开 Issues/Stats tab 白屏 | Server 返回 `{data,meta}` 但 Panel 直接解构 |
| 3 | WebSocket 从未触发 | 修改文件后图不刷新 | `broadcastGraphUpdate()` 是闭包，从未被调用 |
| 4 | UI 引用不存在的端点 | 刷新按钮 404，AI 面板 404 | 前端调用了 `/api/analyze` 和 `/api/ai/chat`，Server 未注册 |

---

## Task 1.1：建立共享数据库路径机制

**根本问题**：`serve` 命令用文件数据库写入分析结果，MCP server 启动时用 `:memory:` 读不到任何东西。

**方案**：在 `shared` 包新建 `dbPath.ts`，所有命令通过同一函数得到 DB 文件路径。

```typescript
// packages/shared/src/utils/dbPath.ts

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'

/**
 * 根据项目根路径生成唯一的 SQLite 文件路径
 * 存放在 ~/.codeomnivis/projects/{hash}.db
 * 同一个项目无论从哪里调用，总是得到同一个路径
 */
export function getDbPath(projectRoot: string): string {
  const absRoot = path.resolve(projectRoot)
  const hash = crypto
    .createHash('md5')
    .update(absRoot)
    .digest('hex')
    .slice(0, 12)

  const dir = path.join(os.homedir(), '.codeomnivis', 'projects')
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
 * 删除项目缓存（用于 codeomnivis init --clean）
 */
export function clearDbCache(projectRoot: string): void {
  const p = getDbPath(projectRoot)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
```

**修改 `packages/analyzer/src/storage/db.ts`**：

```typescript
import { getDbPath } from '@codeomnivis/shared'

export class OmniDatabase {
  constructor(
    // 显式传入路径，不再有默认值
    // 调用方必须提供路径，防止意外用内存数据库
    private readonly dbPath: string
  ) {
    this.db = new Database(dbPath)
    this.init()
  }
}
```

**修改所有命令**（serve.ts / analyze.ts / check.ts / mcp.ts）：

```typescript
import { getDbPath } from '@codeomnivis/shared'

// 在命令 action 函数内：
const projectRoot = path.resolve(options.project ?? '.')
const dbPath = getDbPath(projectRoot)
const db = new OmniDatabase(dbPath)
```

---

## Task 1.2：修复 MCP server 核心逻辑

**修改文件**：`packages/mcp/src/index.ts`

核心修复点：
1. 不再用 `:memory:`
2. 启动时如果 DB 不存在，先运行分析
3. 工具实际从 DB 查询数据

**在 `OmniDatabase` 中新增查询方法**（`packages/analyzer/src/storage/db.ts`）：

- `getNodesByType(types: NodeType[]): OmniNode[]`
- `getDownstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[]`
- `getUpstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[]`
- `findNodeByRoute(route: string): OmniNode | null`
- `findNodeByAny(query: string): OmniNode | null`
- `getAffectedPages(nodeId: string, maxDepth?: number): OmniNode[]`
- `getSubtree(rootId: string, edgeType: EdgeType, maxDepth: number): object`

---

## Task 1.3：修复 IssuesPanel 和 StatsPanel

**根因**：Server 所有 REST 路由统一返回 `{ data: T, meta: {...} }` 格式，但 Panel 组件直接把响应当数据用。

**修复**：
- `IssuesPanel.tsx`：queryFn 返回值改为 `json.data`
- `StatsPanel.tsx`：queryFn 改为 `json.data`，所有 `stats.xxx` 改为 `stats?.xxx ?? '—'`

**新增类型**（`packages/shared/src/types/stats.ts`）：

```typescript
export interface GraphStats {
  nodeCount: number
  edgeCount: number
  isolatedCount: number
  nodesByType: Record<string, number>
  edgesByType: Record<string, number>
  coveragePercent: number
}
```

---

## Task 1.4：接通 WebSocket broadcast

**根因**：`broadcastGraphUpdate()` 是 `server/index.ts` 内部的闭包，从未被导出或调用。

**修复策略**：用 Node.js 原生 `EventEmitter` 作为跨模块事件总线。

新建 `packages/server/src/events.ts`：
```typescript
import { EventEmitter } from 'events'
export const codeomnivisEvents = new EventEmitter()
export const EVENTS = {
  GRAPH_UPDATED: 'graph:updated',
  ANALYSIS_STARTED: 'analysis:started',
  ANALYSIS_COMPLETED: 'analysis:completed',
} as const
```

修改 `server/src/index.ts`：监听 `codeomnivisEvents.on(EVENTS.GRAPH_UPDATED)`，触发时向所有 WebSocket 客户端广播。

修改 `IncrementalAnalyzer`：在文件变更重新分析后，调用 `codeomnivisEvents.emit(EVENTS.GRAPH_UPDATED, filePath)`。

---

## Task 1.5：修复 UI 引用不存在的端点

- 新增 `POST /api/analyze` 路由：触发重新分析
- 新增 `POST /api/ai/chat` 路由：返回 501 Not Implemented，防止 404 崩溃

---

## 验收标准

```bash
# 1. MCP 验证
npx codeomnivis serve &       # 先分析，写入 DB
npx codeomnivis mcp --stdio   # MCP server 读取同一 DB
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_api_routes","arguments":{}},"id":1}' \
  | npx codeomnivis mcp --stdio
# 期望：返回实际的路由数据，不是 []

# 2. UI 验证
# 打开 localhost:4321，点击 Issues tab → 不崩溃，显示问题列表
# 点击 Stats tab → 不崩溃，显示节点统计数字（不是 undefined）

# 3. WebSocket 验证
# 修改 demo 项目中的任意一个 .ts 文件
# 浏览器 Network tab 里的 WS 连接应收到一条消息

# 4. 刷新按钮验证
# 点击 Header 中的刷新按钮 → 不报 404
```

---

## 执行时间线

| 天 | 任务 |
|----|------|
| Day 1 | Task 1.1：数据库路径共享 |
| Day 2 | Task 1.2：MCP 工具实现 |
| Day 3 | Task 1.3 + 1.4 + 1.5：UI Panel 修复 + WebSocket + 端点 |
| Day 4 | 验收测试，修 bug |
