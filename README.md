<div align="center">

```
 ██████╗ ███╗   ███╗███╗   ██╗██╗██╗   ██╗██╗███████╗
██╔═══██╗████╗ ████║████╗  ██║██║██║   ██║██║██╔════╝
██║   ██║██╔████╔██║██╔██╗ ██║██║██║   ██║██║███████╗
██║   ██║██║╚██╔╝██║██║╚██╗██║██║╚██╗ ██╔╝██║╚════██║
╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║ ╚████╔╝ ██║███████║
 ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝  ╚═╝╚══════╝
```

# 🔮 OmniVis — 全栈架构可视化引擎

**一行命令，60 秒，看清整个项目的架构。**

不只是画图——是 **代码语义理解** × **跨层数据流追踪** × **AI 原生集成**。

[![License: MIT](https://img.shields.io/badge/License-MIT-00d4aa.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-≥18-339933.svg)](https://nodejs.org/)

</div>

---

## 🤯 一句话说清楚

> OmniVis 静态分析你的 TypeScript 全栈项目，自动生成 **前端 → API → 数据库** 的完整拓扑图，
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
omnivis mcp   # 启动 MCP Server
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

AI（通过 OmniVis）：
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
omnivis serve          # 🚀 启动可视化服务（自动分析 + 文件监听）
omnivis analyze        # 📊 输出 JSON 图数据
omnivis check          # 🔍 一致性检测 + 死代码 + 循环依赖
omnivis mcp            # 🤖 启动 MCP Server
omnivis init           # ⚙️ 生成 .omnivis.json 配置文件
```

### 配置（可选）

```json
// .omnivis.json — 零配置也能跑，有配置更精准
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
$ omnivis serve

✔ Server running at http://localhost:4321
Configuration loaded from .omnivis.json

Analysis results:
  Files scanned: 62
  Nodes: 73
  Edges: 28

Cross-layer links:
  calls_api:      4
  handles:        9
  calls_service:  12
  queries_db:     7

Node types:
  db_model:       7    ← 数据库模型 + 关系
  page:           9    ← 页面路由 + 动态参数
  component:      48   ← React 组件 + props
  api_route:      9    ← API 路由 + HTTP method
  handler:        9    ← 路由处理函数
  service:        5    ← Service 层
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
$ omnivis check

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
          │  · Express         │ │  文件监听    │ │  · list_db_models  │
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
          │         ~/.omnivis/projects/{hash}.db               │
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
omnivis/
├── packages/
│   ├── shared/       # 共享类型（13 种节点 + 13 种边 + 配置系统）
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
| `@omnivis/shared` | 982 | 13 种节点类型、13 种边类型、配置加载器 |
| `@omnivis/analyzer` | 8,333 | 22 个解析器、数据流追踪、死代码/循环依赖检测 |
| `@omnivis/server` | 759 | REST API、WebSocket 广播、文件监听增量分析 |
| `@omnivis/ui` | 2,291 | 6 个 Tab 面板、Cytoscape 图、数据流可视化 |
| `@omnivis/mcp` | 411 | 5 个 MCP 工具、并发安全、优雅关闭 |
| `@omnivis/cli` | 1,015 | 5 个命令、配置集成、自动框架检测 |
| **总计** | **~13,800** | |

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

## 🎯 性能

| 指标 | 目标 |
|------|------|
| 单文件解析 | < 100ms |
| 100 文件项目 | < 10 秒 |
| UI 布局（100+ 节点） | < 1 秒 |
| 搜索响应 | < 100ms |

---

## 🗺️ Roadmap

### ✅ 已完成

- [x] 22 个解析器（Next.js / tRPC / Express / NestJS / Prisma / Drizzle / TypeORM / Kotlin）
- [x] 跨层连线（前端 → API → Service → DB）
- [x] 数据流追踪（Model → API → Component）
- [x] 死代码检测（死路由 / 死组件 / 死 Service）
- [x] 循环依赖检测（Tarjan SCC）
- [x] 一致性检测（死链 / Method 不匹配 / 缺失 Procedure）
- [x] MCP Server（5 个工具）
- [x] 配置文件系统（.omnivis.json）
- [x] 文件监听增量分析
- [x] WebSocket 实时推送
- [x] 6 个 UI 面板（图谱 / 筛选 / 问题 / 数据流 / AI / 统计）

### 🔜 四周执行计划

详细的执行计划见 [`docs/plans/`](docs/plans/)，每周包含计划书 + 可直接使用的 Claude Code Prompt：

| 周 | 主题 | 计划书 | Prompt |
|----|------|--------|--------|
| 第一周 | 修复 4 个严重 Bug（MCP / UI / WebSocket / 端点） | [week1-mcp-bugfix-plan.md](docs/plans/week1-mcp-bugfix-plan.md) | [week1-prompts.md](docs/plans/prompts/week1-prompts.md) |
| 第二周 | 配置系统 + NestJS 解析器 | [week2-config-nestjs-plan.md](docs/plans/week2-config-nestjs-plan.md) | [week2-prompts.md](docs/plans/prompts/week2-prompts.md) |
| 第三周 | Drizzle ORM + 死代码/循环依赖检测 | [week3-drizzle-deadcode-plan.md](docs/plans/week3-drizzle-deadcode-plan.md) | [week3-prompts.md](docs/plans/prompts/week3-prompts.md) |
| 第四周 | 数据流追踪（Model → API → Component） | [week4-dataflow-plan.md](docs/plans/week4-dataflow-plan.md) | [week4-prompts.md](docs/plans/prompts/week4-prompts.md) |

### 🔜 远期目标

- [ ] 模块聚合（大图折叠）
- [ ] AI 对话式查询
- [ ] VS Code 插件
- [ ] monorepo 多包分析
- [ ] 更多框架支持（Vue / Svelte / Fastify / Hono）

---

## 📄 License

MIT © 2026

---

<div align="center">

**如果你觉得这个项目有用，请给个 ⭐ Star！**

[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

</div>
