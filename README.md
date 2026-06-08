<div align="center">

**[English](README.en.md)** | 中文

```
 ██████╗ ██████╗ ██████╗ ███████╗ ██████╗ ███╗   ███╗███╗   ██╗██╗██╗   ██╗██╗███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔═══██╗████╗ ████║████╗  ██║██║██║   ██║██║██╔════╝
██║     ██║   ██║██║  ██║█████╗  ██║   ██║██╔████╔██║██╔██╗ ██║██║██║   ██║██║███████╗
██║     ██║   ██║██║  ██║██╔══╝  ██║   ██║██║╚██╔╝██║██║╚██╗██║██║╚██╗ ██╔╝██║╚════██║
╚██████╗╚██████╔╝██████╔╝███████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║ ╚████╔╝ ██║███████║
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝  ╚═╝╚══════╝
```

# 🔮 CodeOmniVis — 全栈架构可视化引擎

**一行命令，60 秒，看清整个项目的架构。**

不只是画图——是 **代码语义理解** × **跨层数据流追踪** × **AI 原生集成**。

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-00d4aa.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-≥18-339933.svg)](https://nodejs.org/)

</div>

---

> `npx codeomnivis serve` 在 cal.com 上 →
> **2,535 节点 · 4,592 边 · 15 秒 · 零配置**

## 它能映射什么

| 层 | cal.com 覆盖 |
|-------|-----------------|
| 页面 | 119 ✅ |
| API 路由 | 82 ✅ |
| 数据库模型 (Prisma/Drizzle) | 102 ✅ |
| 组件 | 1,349 ✅ |
| 前端→API 调用 | 172 ✅ |
| 渲染关系 | 3,117 ✅ |

## 支持的框架

Next.js · NestJS · Express · tRPC · **TSRPC**
Prisma · Drizzle · TypeORM · Kotlin Spring/Ktor

## AI 集成 (MCP)

开箱即用，支持 Cursor 和 Claude Desktop。
`find_callers` · `get_api_routes` · `get_component_tree`

## 安装

```bash
npx codeomnivis serve
```

---

## 🤯 一句话说清楚

> CodeOmniVis 静态分析你的 TypeScript 全栈项目，自动生成 **前端 → API → 数据库** 的完整拓扑图，
> 并检测死代码、循环依赖、数据流路径。内置 MCP Server，让 AI 助手直接理解你的架构。

---

## 🔥 核心能力

### 1. 零配置全栈分析

```bash
npx @bynlk/CodeOmniVis serve   # 60 秒内看到完整架构
```

自动检测框架 → 扫描文件 → AST 解析 → 跨层连线 → 可视化。不需要任何配置。

### 2. 22 个解析器，覆盖主流生态

<table>
<tr>
<td align="center" colspan="3"><b>支持的框架</b></td>
</tr>
<tr>
<td><b>前端</b></td>
<td><b>后端</b></td>
<td><b>数据库</b></td>
</tr>
<tr>
<td>

✅ Next.js App Router<br/>
✅ Next.js Pages Router<br/>
✅ React 组件树<br/>
✅ fetch / axios 调用<br/>
✅ tRPC hooks

</td>
<td>

✅ tRPC Router<br/>
✅ Express 路由<br/>
✅ **NestJS** (Controller/Module/Service)<br/>
✅ **TSRPC** (ApiCall/Msg)<br/>
✅ **Spring Boot + Kotlin**<br/>
✅ **Ktor Routing DSL**

</td>
<td>

✅ Prisma Schema<br/>
✅ TypeORM Entity<br/>
✅ **Drizzle ORM** (pg/mysql/sqlite)<br/>
✅ **Exposed ORM**<br/>
✅ **Room (Android)**

</td>
</tr>
</table>

### 3. 不只是拓扑图——架构智能

| 能力 | 说明 |
|------|------|
| **跨层连线** | `fetch('/api/user')` → `GET /api/user` → `User.findUnique()` → `User` 表，全链路自动连线 |
| **数据流追踪** | 选中一个 Model，看它流向了哪些 API 和组件 🌊 |
| **死代码检测** | 🚫 没人调用的路由、🗑️ 没人渲染的组件、🔇 没人用的 Service |
| **循环依赖检测** | 🔄 Tarjan SCC 算法，精准定位循环链 |
| **一致性检测** | 死链 API、HTTP method 不匹配、缺失的 tRPC procedure |

### 4. MCP Server — AI 原生集成

```bash
codeomnivis mcp   # 启动 MCP Server
```

**5 个工具**，让 Cursor / Claude / 任何 AI 助手直接查询你的架构：

| 工具 | 功能 | AI 能问什么 |
|------|------|------------|
| `get_api_routes` | API 路由 + 下游 DB | "有哪些 API？哪些连了数据库？" |
| `get_component_tree` | 组件树 | "Booking 页面用了哪些组件？" |
| `find_callers` | 调用链追踪 | "谁在调用 User 模型？" |
| `list_db_models` | 数据库模型列表 | "有哪些数据表？" |
| `get_dataflow` | 数据流追踪 | "User 数据从 DB 到 UI 怎么流的？" |

```
你：这个项目的认证流程是怎样的？

AI（通过 CodeOmniVis）：
  User → /api/auth → middleware → protectedProcedure → Session
  
  完整调用链，不是猜的。
```

---

## ⚡ Quick Start

```bash
# 全局安装
npm install -g @bynlk/CodeOmniVis

# 或直接运行
npx @bynlk/CodeOmniVis serve
```

浏览器自动打开 → 看到完整的三层架构图 → 点击节点 → 搜索/过滤/缩放。

### 命令

```bash
codeomnivis serve          # 🚀 启动可视化服务（自动分析 + 文件监听）
codeomnivis analyze        # 📊 输出 JSON 图数据
codeomnivis check          # 🔍 一致性检测 + 死代码 + 循环依赖
codeomnivis mcp            # 🤖 启动 MCP Server
codeomnivis init           # ⚙️ 生成 .codeomnivis.json 配置文件
```

### 配置（可选）

```json
// .codeomnivis.json — 零配置也能跑，有配置更精准
{
  "frontend": { "dirs": ["src"], "framework": "next" },
  "backend": { "dirs": ["server"], "framework": "nestjs" },
  "database": { "prismaSchema": "prisma/schema.prisma" },
  "exclude": ["node_modules", "dist", ".next"]
}
```

---

## 🧠 它能看懂什么？

### 自动检测输出

```
$ codeomnivis serve --project ./cal.com

✔ Server running at http://localhost:4321

Scanning 9390 files...
Analysis results:
  Files scanned: 9,390
  Nodes: 1,892
  Edges: 3,347

Node types:
  component:      693   ← React 组件 + props
  handler:        490   ← 路由处理函数
  trpc_procedure: 408   ← tRPC 过程
  page:           104   ← 页面路由 + 动态参数
  db_model:       102   ← 数据库模型 + 关系
  api_route:       82   ← API 路由 + HTTP method
  service:         13   ← Service 层

Edge types:
  renders:       1,622   ← 组件渲染关系
  handles:         490   ← 路由处理绑定
  contains:        342   ← 模块包含关系
  db_relation:     323   ← 数据库表关系
  calls_service:   311   ← 服务调用链
  calls_api:       172   ← 前端调用 API
  queries_db:       87   ← 数据库查询
```

### 跨层连线

```
┌──────────────────────────────────────────────────────────────┐
│  📄 /admin/page.tsx                                          │
│      └──→ 🧩 AdminDashboard                                 │
│              ├──→ 🌐 GET /api/feedback        (calls_api)    │
│              ├──→ 🌐 GET /api/admin/stats     (calls_api)    │
│              └──→ 🧩 PasswordModal                           │
│                      └──→ 🌐 POST /api/verify (calls_api)    │
│                                                              │
│  🌐 POST /api/verify                                         │
│      └──→ ⚡ verifyPassword()                 (handles)      │
│              └──→ 🗄️ User.findUnique          (queries_db)   │
└──────────────────────────────────────────────────────────────┘
```

### 死代码 + 循环依赖检测

```bash
$ codeomnivis check

Consistency Issues:
  Total: 15
  Critical: 0
  Warning: 3
  Info: 12

  🚫 [dead_route] Route has no callers: GET /api/admin/stats
  🗑️ [dead_component] Component not rendered: AdminSidebar
  🔇 [dead_service] Service has no callers: NotificationService
  🔄 [circular_dependency] Circular: UserRepo → AuthService → UserRepo
```

### 数据流追踪 🌊

```
选择 Model: User

🗄️ User → 3 routes → 5 components

API Routes:
  🔗 GET /api/user/:id
  🔗 POST /api/auth/login
  🔗 GET /api/admin/users

Consuming Components:
  ⚛️ UserProfile
  ⚛️ AdminDashboard
  ⚛️ LoginForm
  ⚛️ UserCard
  ⚛️ SettingsPage
```

---

## 🏗️ Architecture

```
                         ┌─────────────────────────────────────┐
                         │          CLI (commander)             │
                         │  serve · analyze · check · mcp · init│
                         └──────────────┬──────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
          ┌─────────┴─────────┐ ┌──────┴──────┐ ┌─────────┴─────────┐
          │   Analysis Engine  │ │   Server    │ │    MCP Server      │
          │                    │ │             │ │                    │
          │  22 Parsers:       │ │  Express    │ │  5 Tools:          │
          │  · Prisma          │ │  REST API   │ │  · get_api_routes  │
          │  · Next.js         │ │  WebSocket  │ │  · get_component   │
          │  · tRPC            │ │  增量分析    │ │  · find_callers    │
          │  · TSRPC           │ │  文件监听    │ │  · list_db_models  │
          │  · Express         │ │             │ │  · get_dataflow    │
          │  · NestJS          │ │             │ │  · get_dataflow    │
          │  · Drizzle         │ └──────┬──────┘ └─────────┬─────────┘
          │  · TypeORM         │        │                  │
          │  · Kotlin/Spring   │        │                  │
          │  · Ktor            │        │                  │
          │  · Exposed         │        │                  │
          │  · Room            │        │                  │
          │                    │        │                  │
          │  CrossLayerLinker  │        │                  │
          │  DataFlowTracer    │        │                  │
          │  ConsistencyChecker│        │                  │
          │  · 死代码检测       │        │                  │
          │  · 循环依赖检测     │        │                  │
          │  · 一致性检测       │        │                  │
          └────────┬───────────┘        │                  │
                   │                    │                  │
          ┌────────┴────────────────────┴──────────────────┴───┐
          │              SQLite (sql.js WASM)                   │
          │         ~/.codeomnivis/projects/{hash}.db               │
          │         零配置 · 文件持久化 · 跨进程共享              │
          └────────────────────────┬───────────────────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │     Web UI         │
                         │  React + Cytoscape │
                         │  dagre 分层布局     │
                         │  搜索/过滤/详情     │
                         │  🌊 数据流面板      │
                         │  ⚠️ 问题检测面板    │
                         │  📊 统计面板        │
                         └───────────────────┘
```

---

## 📦 Monorepo 结构

```
codeomnivis/
├── packages/
│   ├── shared/       # 共享类型（17 种节点 + 15 种边 + 配置系统）
│   ├── analyzer/     # 解析引擎（22 个解析器 + 图算法 + 存储）
│   ├── server/       # Express + WebSocket + 增量分析
│   ├── ui/           # React + Cytoscape.js + 6 个 Tab 面板
│   ├── mcp/          # MCP Server（5 个工具，并发安全）
│   └── cli/          # 5 个命令 + 自动检测 + 配置加载
├── demo/             # 全栈 demo 项目
└── docs/
    ├── plans/        # 四周执行计划 + Claude Code Prompt
    ├── architecture/ # 解析管线、数据模型、可视化设计
    ├── api/          # REST API + MCP 工具文档
    ├── rules/        # AI 开发约束规则
    └── reports/      # 状态报告
```

| 包 | 代码行数 | 功能 |
|----|---------|------|
| `@codeomnivis/shared` | 995 | 17 种节点类型、15 种边类型、配置加载器 |
| `@codeomnivis/analyzer` | 9,557 | 22 个解析器、数据流追踪、死代码/循环依赖检测 |
| `@codeomnivis/server` | 759 | REST API、WebSocket 广播、文件监听增量分析 |
| `@codeomnivis/ui` | 2,328 | 6 个 Tab 面板、Cytoscape 图、数据流可视化 |
| `@codeomnivis/mcp` | 411 | 5 个 MCP 工具、并发安全、优雅关闭 |
| `@codeomnivis/cli` | 1,312 | 5 个命令、配置集成、自动框架检测 |
| **总计** | **~15,362** | |

---

## 🛠️ Tech Stack

| 层 | 技术 | 为什么选它 |
|----|------|-----------|
| 解析核心 | **ts-morph** | 类型安全的 TypeScript AST 分析 |
| DB 解析 | **@prisma/internals** | Prisma 官方 DMMF |
| 图存储 | **sql.js** (WASM SQLite) | 零配置、零依赖、文件持久化 |
| 可视化 | **React** + **Cytoscape.js** + **dagre** | 专为大图设计，自动分层布局 |
| Web 服务 | **Express** + **ws** | WebSocket 实时推送 |
| MCP | **@modelcontextprotocol/sdk** | AI 助手标准协议 |
| CLI | **commander** + **ora** + **chalk** | 优雅的命令行体验 |
| 构建 | **tsup** + **Vite** | ESM 原生，快速构建 |
| 样式 | **Tailwind CSS** | 深色主题 |

---

## 🎯 性能基准（cal.com 验证）

在 [cal.com](https://github.com/calcom/cal.com)（9,390 文件的大型全栈项目）上验证：

| 指标 | 数值 |
|------|------|
| 扫描文件 | 9,390 |
| 节点 | 1,892 |
| 边 | 3,347 |
| 错误 | 0 |

### 节点类型分布

| 类型 | 数量 | 说明 |
|------|------|------|
| component | 693 | React 组件 |
| handler | 490 | 请求处理器 |
| trpc_procedure | 408 | tRPC 过程 |
| page | 104 | 页面路由 |
| db_model | 102 | 数据库模型 |
| api_route | 82 | API 路由 |
| service | 13 | 服务层 |

### 边类型分布

| 类型 | 数量 | 说明 |
|------|------|------|
| renders | 1,622 | 组件渲染关系 |
| handles | 490 | 路由处理绑定 |
| contains | 342 | 模块包含关系 |
| db_relation | 323 | 数据库表关系 |
| calls_service | 311 | 服务调用链 |
| calls_api | 172 | 前端调用 API |
| queries_db | 87 | 数据库查询 |

### 代码质量

- **0 `any`** — 源代码 + 测试文件零 `any` 使用
- **0 `this.db!`** — 全部替换为类型安全的 `getDb()` helper
- **降级而非崩溃** — 所有解析器 try-catch，WASM 失败不崩溃
- **增量更新** — 图 diff 更新，不再全量重建布局

---

## 🗺️ Roadmap

### ✅ 已完成

- [x] 22 个解析器（Next.js / tRPC / TSRPC / Express / NestJS / Prisma / Drizzle / TypeORM / Kotlin）
- [x] 跨层连线（前端 → API → Service → DB）
- [x] 数据流追踪（Model → API → Component）
- [x] 死代码检测（死路由 / 死组件 / 死 Service）
- [x] 循环依赖检测（Tarjan SCC）
- [x] 一致性检测（死链 / Method 不匹配 / 缺失 Procedure）
- [x] MCP Server（5 个工具）
- [x] 配置文件系统（.codeomnivis.json）
- [x] 文件监听增量分析
- [x] WebSocket 实时推送
- [x] 6 个 UI 面板（图谱 / 筛选 / 问题 / 数据流 / AI / 统计）
- [x] 全量代码审查（61 个发现，59 个已修复）
- [x] 零 `any` 类型安全（74 处 → 0 处）
- [x] 降级而非崩溃（所有解析器 + 数据库 + WebSocket）
- [x] 性能优化（增量布局、缓存、去轮询）

### 🔜 远期目标

- [ ] 模块聚合（大图折叠）
- [ ] AI 对话式查询
- [ ] VS Code 插件
- [ ] monorepo 多包分析
- [ ] 更多框架支持（Vue / Svelte / Fastify / Hono）

---

## 📄 开源协议

[PolyForm Noncommercial License 1.0.0](LICENSE) — 非商业使用许可

✅ 个人使用、学习、研究、非营利组织、教育机构
❌ 商业使用、售卖、付费服务、广告盈利

商业用途请联系作者获取授权。

---

<div align="center">

**如果你觉得这个项目有用，请给个 ⭐ Star！**

[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

</div>
