# CodeOmniVis 前端重设计 Brief

> 这是一份完整的设计素材包：现状审计 + 问题清单 + 数据契约 + API 接口 + 设计目标。
> 可直接交给 Claude / Cursor / v0 / Bolt 等强 AI 作为重设计上下文。
> ⚠️ 现状部分务必如实读，否则新设计会重蹈覆辙。

---

## 0. 设计目标（给 AI 的「必达」清单）

| # | 目标 | 验收 |
|---|------|------|
| G1 | **3 秒定位信息**：任意节点详情、上下游、问题数、链路追踪，都能在 3 秒内拿到 | 实测节点单击 → 右侧面板 ≤100ms，Issue Badge 正确非 0 |
| G2 | **布局有主次**：Header / Sidebar / 画布 / 面板 视觉层级分明；主内容区是绝对焦点 | z-index 固定分层，遮罩不穿透 |
| G3 | **搜索合一**：只有一种搜索入口，语义一致，结果直接跳图+高亮 | 顶栏搜索 = ⌘K = 唯一 filter |
| G4 | **图例必须**：所有 NodeType / EdgeType 颜色一目了然 | 常驻 Legend 或等效暴露 |
| G5 | **响应式**：sm/md/lg 三个断点，移动端可降级使用 | 窄屏下 Sidebar/面板可抽屉化 |
| G6 | **可访问性**：键盘可达、ARIA 完整、动画可关闭 | 通过 axe / Lighthouse a11y ≥ 90 |
| G7 | **API 解耦**：所有 `/api/*` 抽到 service 层，UI 不写 fetch | 100% service 化 |
| G8 | **状态分层**：UI 状态 ≠ 服务端状态 ≠ 图交互状态，三者分开 | 无明显"状态中心"大组件 |
| G9 | **FCP ≤ 2s**：main chunk ≤ 80KB，vendor-react 单块无循环 | 实测 Lighthouse |

---

## 1. 现状全貌（必须如实读）

### 1.1 源文件清单（4133 行 / 46 文件）

| 文件 | 行数 | 职责 |
|------|------|------|
| `App.tsx` | 179 | **状态中心 + 布局编排 + 事件总线**（7 useState / 3 useMemo / 2 useEffect） |
| `GraphCanvas.tsx` | 196 | Cytoscape 渲染 + 布局算法（82 行单函数）+ 选择高亮 |
| `SettingsDrawer.tsx` | 196 | AI 配置 + 项目切换 + 语言 + 推广位 + 关于（5 个领域混一） |
| `TracePanel.tsx` | 176 | 链路追踪动画 + AI 解说 + selection + 聚焦 |
| `lib/aiConfig.ts` | 179 | localStorage AI 配置读写（含 SSRF 校验） |
| `utils/cytoscapeConfig.ts` | 276 | **唯一** Cytoscape 样式源（16+ 条 selector） |
| `components/TabBar/DataFlowPanel.tsx` | 167 | 下拉选 Model → 展示 routes/components |
| `components/TabBar/AiPanel.tsx` | 165 | 聊天 UI + 上下文拉取 + 错误处理 + AbortController |
| `components/Filter/FilterPanel.tsx` | 158 | NodeType / EdgeType / Confidence 三类过滤 |
| `components/CommandPalette.tsx` | 152 | ⌘K 命令面板（搜索 + 跳转） |
| `components/AiConfigForm.tsx` | 144 | Base URL / Key / Model 三字段 + 连通测试 |
| `components/TabBar/StatsPanel.tsx` | 142 | 节点/边/孤立节点/覆盖率 4 卡片 |
| `components/Sidebar.tsx` | 138 | 节点列表 + emoji 分类 + 选中态 |
| `components/Graph/NodeTooltip.tsx` | 136 | 鼠标悬停 tooltip（pointer-events: none） |
| `components/NodeDetailPanel.tsx` | 131 | 节点详情 + 入/出边列表 |
| `hooks/websocketController.ts` | 130 | ws 消息路由器 |
| `components/Header.tsx` | 116 | 搜索框 + 语言 + 设置 + 刷新 |
| `lib/graphFilterController.ts` | 116 | 过滤状态机 |
| `components/TabBar/IssuesPanel.tsx` | 104 | 问题列表（badge 硬编码 0，永远不亮） |
| `utils/graphTransform.ts` | 103 | Graph → Cytoscape elements 转换 |
| `hooks/useGraphFilter.ts` | 91 | 过滤 hook |
| `components/TabBar/TraceStepCard.tsx` | 87 | 链路站点卡片（含 5 站点缩略图） |
| `hooks/useWebSocket.ts` | 79 | ws 心跳（isConnected 未在任何 UI 暴露） |
| `components/TabBar/TraceRunner.tsx` | 71 | 链路追踪动画时间轴 |
| `lib/promotion.ts` | 61 | 设置抽屉推广位内容 |
| `components/Header/FreshnessBadge.tsx` | 55 | fresh/stale/analyzing 状态 |
| `hooks/useGraph.ts` | 54 | 拉取 `/api/graph` |
| `lib/traceIndex.ts` | 51 | 链路站索引 |
| `components/TabBar/TabBar.tsx` | 50 | Tab 栏（7 个 Tab + Badge） |
| `hooks/useSearch.ts` | 49 | 顶栏搜索 hook |
| `components/Filter/FilterChip.tsx` | 48 | 过滤 chip |
| `components/TabBar/TabPanel.tsx` | 47 | Tab 面板容器（absolute 覆盖画布） |
| `hooks/useAiConfig.ts` | 43 | AI 配置 hook |
| …其余 12 个文件 < 40 行 | — |

### 1.2 布局骨架

```
┌──────────────────────────── Header (h-14, bg-slate-800) ────────────────────────────┐
├──────┬─────────────────────────────────────────────────────────────────┬──────────────┤
│Side  │  main.flex-1.relative                                           │ NodeDetail  │
│bar   │  ┌──────────────────────────────────────────────────────┐       │ Panel       │
│w-64  │  │ TabPanel.absolute top-0 z-10 max-h-64              │       │ absolute    │
│      │  │ bg-slate-800/95 backdrop-blur-sm                    │       │ right-0 w-80│
│      │  └──────────────────────────────────────────────────────┘       │             │
│ always│  GraphCanvas.w-full.h-full                                         │ show/hide   │
│      │  NodeTooltip.fixed.z-50 pointer-events:none                      │             │
├──────┴─────────────────────────────────────────────────────────────────┴──────────────┤
CommandPalette: fixed inset-0 z-50 遮罩
SettingsDrawer: fixed inset-0 z-50 justify-end 遮罩
```

### 1.3 Tab 系统（7 个，现状）

| Tab | 图标 | Panel 组件 | 问题 |
|-----|------|-----------|------|
| graph | 🗺️ | null | 占位 + 切回清空 panel 状态 |
| filter | 🔍 | FilterPanel | 覆盖画布 |
| issues | ⚠️ | IssuesPanel | badge 硬编码 0，永远不提示 |
| dataflow | 🌊 | DataFlowPanel | 下拉无搜索，model 多时难找 |
| trace | 🛤️ | TracePanel | 动画 + 解说 + 聚焦三责混一 |
| ai | 🤖 | AiPanel | 配置路径远，无上下文则禁用 |
| stats | 📊 | StatsPanel | 覆盖率 100% 静态假数据 |

---

## 2. 问题清单（按严重度分级）

### 🔴 Critical（必修复，直接阻碍使用）

| # | 现象 | 根因 | 文件 |
|---|------|------|------|
| C1 | **前端 TypeError 不加载** | `use-sync-external-store` CJS shim 与 vendor-react 形成跨 chunk 循环依赖。浏览器按 modulepreload 先求值 vendor，此时 vendor-react 未求值，`r` 摸到空壳 | 已修 (vite.config.ts) |
| C2 | **Badge 永远为 0，用户不知道有问题** | `issueBadgeCount={0}` 硬编码 | `App.tsx:124` |
| C3 | **WebSocket 连接状态不可见** | `useWebSocket` 返回 `isConnected` 但无消费 | `hooks/useWebSocket.ts:42` |
| C4 | **API 散落 UI 6 处**，无 service 层，无统一错误处理，无重试 | Header / SettingsDrawer / AiPanel / DataFlowPanel / IssuesPanel / StatsPanel 各自 `fetch('/api/...')` | 跨多个文件 |
| C5 | **搜索双轨：顶栏只过滤 Tab，⌘K 才搜图**，两套算法、两套状态、结果不一致 | `useSearch.ts`（顶栏） vs `searchNodes.ts`（⌘K） | `hooks/useSearch.ts` / `lib/searchNodes.ts` |

### 🟠 Major（体验重度损伤）

| # | 现象 | 根因 | 文件 |
|---|------|------|------|
| M1 | **App.tsx 状态中心**：7 useState + 3 useMemo + 2 useCallback + 1 useEffect + 布局编排 | 无状态管理库，盲目下钻 | `App.tsx` |
| M2 | **图例（Legend）完全缺失**：14 NodeType + 12 EdgeType 颜色映射只在代码维护 | 用户无法记住颜色 | — |
| M3 | **两面板可同时抢占主画布**：TabPanel absolute top z-10 + NodeDetailPanel absolute right 未协调 | z-index 无主控 | `App.tsx` |
| M4 | **响应式完全缺失**：全部固定宽度，手机端不可用 | 无 Tailwind 断点 | 全部布局组件 |
| M5 | **Graph.tsx remove + add 暴力刷图**，无过渡动画 | layout 重跑 cose 无过渡 | `GraphCanvas.tsx` |
| M6 | **SettingsDrawer 职责过重**（4 领域混一） | AI 配置 + 项目切换 + 语言 + 推广 + 关于 | `SettingsDrawer.tsx` |
| M7 | **TracePanel 职责过重**：动画 timer + AI fetch + 协调 + selection + 聚焦 | — | `TracePanel.tsx` |
| M8 | **Tooltip 可被遮罩穿透**：CommandPalette 打开时 NodeTooltip hover 仍触发 | 同 z-50 + 无主控 | `NodeTooltip.tsx` |

### 🟡 Minor（体验轻度损伤，不能不管）

| # | 现象 | 根因 |
|---|------|------|
| N1 | Tailwind token `node.*` 与 `cytoscapeConfig.ts` 硬编码颜色脱节 | 双源 |
| N2 | `* { margin:0; padding:0; box-sizing:border-box }` 暴力 reset | 破坏原生表单 |
| N3 | i18n 未覆盖：ErrorBoundary / AI prompt / emoji 硬编码 | — |
| N4 | `moduleIdCounter` 模块级 mutable，SSR 会泄漏 | `AiPanel.tsx` |
| N5 | 推广位占设置抽屉 40% 空间 | `promotion.ts` |
| N6 | Cytoscape 内部 `z-index: 9999` 与 React z-index 层级冲突 | trace 光点 |
| N7 | 无障碍全缺失：aria 全空，无 role | — |

---

## 3. 数据契约（保持，不要改）

> 与 server 共用的结构，重设计时必须 100% 兼容，否则 serve 会崩。

### 3.1 OmniGraph（`packages/shared/src/types/graph.ts`）

```ts
interface OmniGraph { nodes: OmniNode[]; edges: OmniEdge[] }
interface ParseResult { nodes: OmniNode[]; edges: OmniEdge[]; errors: ParseError[] }
interface ParseError { file: string; message: string; severity: 'error' | 'warning' | 'info' }
```

### 3.2 OmniNode（`packages/shared/src/types/node.ts`）

**NodeType 共 17 种：**
`page | component | api_route | trpc_procedure | tsrpc_service | tsrpc_api | tsrpc_msg | express_route | handler | service | db_model | module | kotlin_class | kotlin_interface | kotlin_object | kotlin_function | kotlin_route`

```ts
type OmniNode = discriminated union, driven by `type`:
  id: string               // {type}:{filePath}:{name}
  type: T                  // NodeType
  name: string
  filePath: string        // 相对项目根目录
  line: number
  column: number
  metadata: NodeTypeMetadataMap[T]  // 类型安全的 metadata
```

每种 type 对应独立 metadata interface（Page / Component / ApiRoute / TrpcProcedure / TsrpcService / TsrpcApi / TsrpcMsg / ExpressRoute / Handler / Service / DbModel / Module / *Kotlin* 共 11 个 Kotlin 接口）。详见 `packages/shared/src/types/node.ts` 全文。

### 3.3 OmniEdge（`packages/shared/src/types/edge.ts`）

**EdgeType 共 15 种：**
`renders | navigates_to | calls_api | handles | calls_service | queries_db | db_relation | imports | contains | data_flows_to | sends_msg | listens_msg | kotlin_inherits | kotlin_implements | kotlin_uses`

```ts
type OmniEdge = discriminated union, driven by `type`:
  id: string               // {sourceId}--{type}--{targetId}
  source: string
  target: string
  type: T                  // EdgeType
  confidence: 'certain' | 'inferred'
  metadata: EdgeTypeMetadataMap[T]
```

### 3.4 Trace（`packages/shared/src/types/trace.ts`）

```ts
type TraceLayer = 'frontend' | 'api' | 'logic' | 'data' | 'other'

interface TraceStep {
  index: number            // 从 1 递增
  nodeId: string
  nodeName: string
  nodeType: NodeType
  layer: TraceLayer
  filePath: string
  line: number
  edgeFromPrev: EdgeType | null  // 首站 null
  explanation: string      // 自动说明
}

interface TraceResult {
  rootId: string
  steps: TraceStep[]
  totalSteps: number
}
```

### 3.5 Stats（server 计算后返回）

```
/api/graph/stats → { totalNodes, totalEdges, isolatedNodes, connectedNodes, coverage }
```

### 3.6 DataFlow

```ts
/api/graph/dataflow?model=<name> → { model, apiNodes, componentNodes, summary }
/api/graph/dataflow            → 全量 overview
/api/graph/nodes?type=db_model → 下拉列表
```

---

## 4. Server API 接口（必须 100% 兼容）

| 方法 | 路径 | 用途 | Body |
|------|------|------|------|
| GET  | `/api/graph` | 拉取全图 `{ nodes, edges }` | — |
| GET  | `/api/graph/stats` | 图统计 | — |
| GET  | `/api/graph/nodes?type=db_model` | DB Model 下拉列表（DataFlow 用） | — |
| GET  | `/api/graph/dataflow` | 全量 data flow | — |
| GET  | `/api/graph/dataflow?model=X` | 单 model data flow | — |
| GET  | `/api/graph/errors` | 问题列表 | — |
| GET  | `/api/status` | 项目状态（被 ws 推送的 status_changed 驱动） | — |
| GET  | `/api/health` | 心跳 | — |
| POST | `/api/analyze` | 触发重新分析（Header 刷新按钮调用） | `{}` |
| POST | `/api/project` | 切换项目目录 | `{ projectRoot: string }` |
| POST | `/api/ai/chat` | AI 聊天（AiPanel 用） | `{ messages: ChatMessage[], config?: AiConfig }` |
| POST | `/api/ai/explain` | AI 链路解说（TracePanel 用） | `{ messages, config? }` |

### 4.1 AI 请求包体（`/api/ai/chat` 与 `/api/ai/explain` 共用）

```ts
interface AiChatRequest {
  messages: ChatMessage[]    // system/user/assistant
  config?: { baseUrl: string; apiKey: string; model: string }  // 前端 localStorage 下发，不落库
}
interface AiChatResponse { content: string }
```

---

## 5. 现有组件间的隐含约束（重设计不能打破）

| # | 约束 | 出处 |
|---|------|------|
| R1 | `/api/analyze` 触发后，server 通过 ws 推送 `status_changed`，UI 必须反映 analyzing→fresh 动画 | `hooks/websocketController.ts` |
| R2 | `/api/graph` 在 analyze 完成后有新图；`useGraph` 的 cacheKey 必须与 freshness 同步 | `hooks/useGraph.ts` |
| R3 | 切换 `/api/project` 后需要刷新 graph、stats、issues、dataflow 等所有接口，且 ws 要重连 | `SettingsDrawer.tsx` |
| R4 | Cytoscape 实例贯穿整个 app，通过 `CytoscapeContext` 共享（`cyRef`） | `lib/cytoscapeContext.ts` |
| R5 | 选中态通过 `SelectionContext` 共享（当前仅传 string） | `lib/selectionContext.ts` |
| R6 | Tab 的 `graph` tab 对应 `panelComponent: null`，`activeTab=null` 时回到纯画布 | `App.tsx:17-25` |
| R7 | 颜色 token：Tailwind 用 `node.*`（见下文），Cytoscape 内必须一致（现状双源） | `tailwind.config.ts` / `cytoscapeConfig.ts` |

---

## 6. 设计资产（重设计可直接复用 / 对齐）

### 6.1 视觉 token（Tailwind 主题）

```ts
primary:   50-950 (blue-sky)
node:      page=#8b5cf6, component=#06b6d4, api=#10b981,
           handler=#f59e0b, service=#ef4444, db=#ec4899
animation: slideDown(0.2s ease-out), fadeIn(0.15s ease-out)
```

### 6.2 节点 emoji（`lib/nodeConfig.ts`）

```
📄 page  🧩 component  🔗 api_route/tsrpc_service  ⚡ trpc_procedure
🔌 tsrpc_api  📨 tsrpc_msg  🚂 express_route  ⚙️ handler  🔧 service
🗄️ db_model  📦 module
🟣 kotlin_class  🔷 kotlin_interface  🟠 kotlin_object  🟢 kotlin_function  🟡 kotlin_route
```

### 6.3 推荐信息层级（重设计参考）

```
① Header：永远可见。品牌 · 搜索（唯一入口） · AI 状态 · 设置按钮 · freshness
② Sidebar：常驻左。节点列表（按类型分组 + 搜索高亮 + badge）
③ 主画布：Cytoscape 绝对舞台 + 节点选中 + 缩放 + 拖拽
④ 节点详情面板：右 overlay，选中才出现。基本信息 · 入/出边/操作
⑤ 命令面板：⌘K 唯一搜索/命令入口（重构：合并顶栏搜索语义）
⑥ Settings 抽屉：⚙ 触发。AI / 项目 / 语言 / 关于（拆 Tab 或分组即可）
⑦ 通知 / Badge：全局唯一 snackbar/issue badge
```

---

## 7. 给 AI 的「不可协商」指令

请把以下指令传给重设计的 AI：

1. **不要搞动画炫技过渡**：Cytoscape 的 cose 布局不要又 add 又 remove，Node 出现/消失过渡必须走 Cytoscape `animationFrame` 或 CSS opacity。
2. **图例必须有**：在 Sidebar 或 Header 子菜单常驻暴露 17 种 NodeType + 15 种 EdgeType 的 emoji + 颜色 + 图例。
3. **Badge 必须接数据**：从 `/api/graph/errors` 长度驱动，从 server 拉（`severity='error'` 才红）。
4. **搜索合流**：顶栏 = ⌘K 面板 = 唯一搜索结果，合并 query state，结果支持「跳图 + 高亮 + 定位」三连。
5. **Tab 面板不要 absolute 覆盖画布**：改用 overlay 容器或浮动卡片，不挡节点；或改成底部抽屉（尤其移动端）。
6. **websocket 状态必须暴露**：connecting / connected / reconnecting / error 四种状态应有视觉指示（Header 右上小灯）。
7. **tabs 分组或减少**：7 个 Tab 是信息过载。建议合并：
   - `graph`：纯画布（移除或保留空）
   - `filter` + `search` → 合并为 Sidebar 顶
   - `issues`（必须带 badge）
   - `dataflow` / `trace` → 合进"链路追踪"单一入口
   - `ai`：保留单独入口，但配置从 Settings 降级为 sub-tab
   - `stats`：可以考虑放到 footer/tooltip
8. **响应式**：≤768px Sidebar 自动抽屉化（overlay + hamburger）；≤640px Tab 横向滑动或折叠。
9. **所有 fetch 抽到 `services/` 一个目录**：`graph.ts` / `ai.ts` / `project.ts` / `trace.ts` / `issues.ts`，UI 一个也不写 `fetch(...)`。
10. **状态分层**：
    - `useGraph` / `useWebSocket` / `useStatus` → SWR / React Query 管理（服务端状态）
    - 当前选中 / 当前 tab / 搜索词 → Zust / Jotai（UI 状态）
    - Cytoscape 实例（图交互状态） → ref + context

---

## 8. 技术栈（不要改）

| 项 | 现状 | 备注 |
|----|------|------|
| UI 框架 | React 18 + TypeScript | — |
| 渲染器 | Cytoscape 3 + dagre | 不可替换，但要正确初始化 |
| 样式 | Tailwind 3 原生 + postcss + autoprefixer | — |
| http 客户端 | 现用 fetch（重设计改用 service 封装） | 可引入 ky 或 axios |
| ws | 原生 `WebSocket` | — |
| 构建 | Vite 5 + tsup 拷贝到 cli/dist/ui | — |
| 国际化 | i18next + react-i18next | — |
| 仓库 | pnpm workspace + Turborepo | — |

---

## 9. 验收入口（给 AI 自检问）

交付前 AI 必须回答：

1. 用户第一次进来，能在 **5 秒内**把"我的项目有哪些层、有哪些问题"搞清楚吗？
2. 任何一个节点，从选看到看到详情、上下游、跳到定义文件，需要几步？
3. 图例在哪？颜色编码是否一眼可辨？
4. Tab 数≤4 吗？信息层级主次清晰吗？
5. 手机端（375px 宽度）能用吗？
6. 键盘只按 Tab/Enter/ESC 能完成核心工作流吗？
7. 首次加载 ≤ 2s（main chunk ≤ 80KB）吗？

**六个都是"是"才算交付。**

---

*文档生成时间：2026-07-07；现状审计范围：packages/ui/src 全部 46 文件 4133 行；server API 路线覆盖 packages/server 全部路由；数据契约覆盖 packages/shared 全部共用类型。*
