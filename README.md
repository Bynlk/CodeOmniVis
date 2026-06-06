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

[![License: MIT](https://img.shields.io/badge/License-MIT-00d4aa.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-≥18-339933.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0-f69220.svg)](https://pnpm.io/)

<br/>

**[English](#english) · [中文](#中文) · [Features](#-what-it-does) · [Quick Start](#-quick-start) · [AI Integration](#-for-ai-agents)**

</div>

---

## 🤯 这是什么？

OmniVis 是一个 **零配置 CLI 工具**，能自动分析 TypeScript 全栈项目，生成 **交互式架构拓扑图**。

它能看懂你的代码在干什么——不是静态分析，是 **真正的语义理解**：

```
你的代码                    OmniVis 输出
─────────                  ──────────────
page.tsx          ──→      📄 页面节点 + 路由路径
Component.tsx     ──→      🧩 组件节点 + props + state
route.ts          ──→      🌐 API 路由 + HTTP method
router.ts         ──→      ⚡ tRPC procedure + 类型
schema.prisma     ──→      🗄️ 数据库模型 + 关系

fetch('/api/xxx') ──→      ──→ 连线 ──→
trpc.user.useQuery──→      ──→ 连线 ──→    完整调用链路
axios.post(...)   ──→      ──→ 连线 ──→
```

**前端组件 → API 路由 → 后端处理 → 数据库模型**，全链路可视化。

---

## 🔥 为什么屌？

### 不是画图工具，是代码理解引擎

| 其他工具 | OmniVis |
|----------|---------|
| 手动画架构图 | **自动扫描，零配置** |
| 静态文件树 | **语义级理解（知道谁调用谁）** |
| 只看单层 | **三层穿透（前端→API→DB）** |
| 需要配置 | **`npx omnivis serve` 就完了** |
| 不懂框架 | **原生支持 Next.js/tRPC/Prisma/Express/TypeORM** |

### 支持的框架

<table>
<tr>
<td align="center"><b>前端</b></td>
<td align="center"><b>后端</b></td>
<td align="center"><b>数据库</b></td>
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

✅ tRPC Router（嵌套）<br/>
✅ Express 路由<br/>
✅ API Routes<br/>
✅ HTTP Method 提取<br/>
✅ **Spring Boot + Kotlin**<br/>
✅ **Ktor Routing DSL**

</td>
<td>

✅ Prisma Schema<br/>
✅ TypeORM Entity<br/>
✅ 关系识别（1:1/1:N/M:N）<br/>
✅ 字段提取<br/>
✅ **Exposed ORM**<br/>
✅ **Room (Android)**

</td>
</tr>
</table>

---

## ⚡ Quick Start

```bash
# 一行命令，看到你的项目架构
npx omnivis serve
```

就这么简单。

浏览器自动打开 → 看到完整的三层架构图 → 点击节点详情 → 搜索/过滤/缩放。

### 更多命令

```bash
omnivis serve      # 🚀 启动可视化服务
omnivis analyze    # 📊 输出 JSON 图数据
omnivis check      # 🔍 一致性检测
omnivis mcp        # 🤖 启动 MCP Server（给 AI 用）
omnivis init       # ⚙️ 生成配置文件
```

---

## 🧠 它能看懂什么？

### 📊 自动检测

```
$ omnivis serve

✔ Server running at http://localhost:4321

Analysis results:
  Files scanned: 62
  Nodes: 73
  Edges: 28

Cross-layer links:
  calls_api: 4

Node types:
  db_model: 7       ← 7 个数据库模型，关系全连好
  page: 9           ← 9 个页面路由，含动态参数
  component: 48     ← 48 个 React 组件，含 props/state
  api_route: 9      ← 9 个 API 路由，含 HTTP method
```

### 🔗 跨层连线

OmniVis 能追踪 **完整的调用链路**：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  📄 /admin/page.tsx                                         │
│      │                                                      │
│      └──→ 🧩 AdminDashboard                                │
│              │                                              │
│              ├──→ 🌐 /api/feedback          (fetch GET)     │
│              ├──→ 🌐 /api/admin/stats       (fetch GET)     │
│              │                                              │
│              └──→ 🧩 PasswordModal                          │
│                      │                                      │
│                      └──→ 🌐 /api/admin/verify-password     │
│                                                              │
│  🌐 /api/admin/verify-password                              │
│      │                                                      │
│      └──→ 🗄️ User (prisma.user.findUnique)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 🔍 一致性检测

```bash
$ omnivis check

Consistency Issues:
  Total: 72
  ℹ️ [unused_route] Route appears to be unused: /api/admin/stats
  ℹ️ [unused_route] Node has no connections: AdminDashboard
  ℹ️ [method_mismatch] HTTP method mismatch: ...
  ℹ️ [missing_procedure] tRPC procedure not found: ...
```

自动发现：死链 API 调用、未使用路由、HTTP method 不匹配、缺失的 tRPC procedure。

---

## 🤖 For AI Agents

### MCP Server — 让 AI 看懂你的架构

OmniVis 内置 **MCP (Model Context Protocol) Server**，让 Cursor、Claude、或其他 AI 助手 **直接查询你的项目架构**。

```bash
omnivis mcp
```

AI 可以调用的工具：

| 工具 | 功能 | 示例问题 |
|------|------|----------|
| `getApiRoutes` | 获取所有 API 路由 | "这个项目有哪些 API？" |
| `getComponentTree` | 获取组件树 | "Admin 页面用了哪些组件？" |
| `findCallers` | 查找调用链 | "谁在调用 /api/feedback？" |

### 实际效果

```
你：这个项目的认证流程是怎样的？

AI（通过 OmniVis MCP）：
  1. 前端 AuthProvider 组件调用 /api/auth/[...nextauth]
  2. NextAuth 处理 OAuth + JWT
  3. Session 存储在数据库 Session 表
  4. 受保护路由通过 middleware.ts 检查 session
  5. tRPC router 通过 protectedProcedure 验证

  调用链：AuthProvider → /api/auth → middleware → protectedProcedure → Session 表
```

**AI 不再瞎猜，而是基于真实的代码分析。**

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────────────────┐
                    │              CLI Entry Point              │
                    │           npx omnivis serve               │
                    └───────────────┬──────────────────────────┘
                                    │
                    ┌───────────────┴──────────────────────────┐
                    │          Analysis Engine                  │
                    │                                          │
                    │  ┌─────────────────────────────────────┐ │
                    │  │  8 Parsers                          │ │
                    │  │  ┌──────────┐ ┌──────────────┐     │ │
                    │  │  │ Prisma   │ │ Next.js App  │     │ │
                    │  │  │ TypeORM  │ │ Next.js Pages│     │ │
                    │  │  │ tRPC     │ │ Express      │     │ │
                    │  │  │ React    │ │ API Calls    │     │ │
                    │  │  └──────────┘ └──────────────┘     │ │
                    │  └─────────────────────────────────────┘ │
                    │                    │                      │
                    │  ┌─────────────────┴───────────────────┐ │
                    │  │  CrossLayerLinker                   │ │
                    │  │  前端 ──→ API ──→ DB 全链路连线       │ │
                    │  └─────────────────────────────────────┘ │
                    │                    │                      │
                    │  ┌─────────────────┴───────────────────┐ │
                    │  │  ConsistencyChecker                 │ │
                    │  │  死链检测 · 未使用路由 · Method 匹配   │ │
                    │  └─────────────────────────────────────┘ │
                    │                    │                      │
                    │  ┌─────────────────┴───────────────────┐ │
                    │  │  SQLite Store (sql.js WASM)         │ │
                    │  │  零配置 · 跨平台 · 事务支持            │ │
                    │  └─────────────────────────────────────┘ │
                    └──────────────────────────────────────────┘
                                    │
                    ┌───────────────┴──────────────────────────┐
                    │           REST API + WebSocket            │
                    │     Express · CORS · 实时推送              │
                    └───────────────┬──────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────┴─────────┐ ┌────────┴────────┐ ┌─────────┴─────────┐
    │    Web UI          │ │   MCP Server    │ │   CLI Output      │
    │  React + Cytoscape │ │  AI 助手接口    │ │  JSON / Report    │
    │  dagre 分层布局     │ │  3 个工具       │ │  一致性检测        │
    │  搜索/过滤/详情     │ │  stdio 传输     │ │                   │
    └───────────────────┘ └─────────────────┘ └───────────────────┘
```

---

## 📦 Monorepo 结构

```
omnivis/
├── packages/
│   ├── shared/       # 共享类型（OmniNode, OmniEdge, OmniGraph）
│   ├── analyzer/     # 解析引擎（8 个解析器 + 跨层连线 + 一致性检测）
│   ├── server/       # Express Web 服务 + WebSocket
│   ├── ui/           # React + Cytoscape.js 可视化前端
│   ├── mcp/          # MCP Server（AI 助手接口）
│   └── cli/          # CLI 入口（serve/analyze/check/mcp/init）
├── demo/             # 全栈 demo 项目
└── docs/             # 文档
```

| 包 | 源码行数 | 功能 |
|----|---------|------|
| `@omnivis/shared` | 768 | 9 种节点类型、9 种边类型、完整 metadata |
| `@omnivis/analyzer` | 4,771 | 8 个解析器、图构建、存储、跨层连线 |
| `@omnivis/server` | 392 | REST API、WebSocket、静态文件服务 |
| `@omnivis/ui` | 1,134 | Cytoscape.js 图、搜索、过滤、详情面板 |
| `@omnivis/mcp` | 196 | MCP Server 3 个工具 |
| `@omnivis/cli` | 767 | 5 个命令、自动检测、进度条 |
| **总计** | **~9,100** | |

---

## 🛠️ Tech Stack

| 层 | 技术 | 为什么选它 |
|----|------|-----------|
| 解析核心 | **ts-morph** + **@prisma/internals** | 类型安全的 AST 分析，Prisma 官方 DMMF |
| 图存储 | **sql.js** (WASM SQLite) | 零配置、零依赖、跨平台 |
| 可视化 | **React** + **Cytoscape.js** + **dagre** | 专为大图设计，自动分层布局 |
| Web 服务 | **Express** + **ws** | 轻量、成熟、WebSocket 支持 |
| MCP | **@modelcontextprotocol/sdk** | AI 助手标准协议 |
| CLI | **commander** + **ora** + **chalk** | 优雅的命令行体验 |
| 构建 | **tsup** (包) + **Vite** (UI) | 快速、ESM 原生 |
| 样式 | **Tailwind CSS** | 原子化、深色主题友好 |

---

## ⚙️ 配置

```json
// .omnivis.json
{
  "version": "0.0.1",
  "frontend": "auto",
  "backend": "auto",
  "database": "auto",
  "exclude": ["node_modules", ".next", "dist", "build"],
  "server": {
    "port": 4321,
    "host": "localhost"
  }
}
```

**零配置也能跑** — OmniVis 会自动检测项目类型。

---

## 🎯 性能目标

| 指标 | 目标 | 实测 |
|------|------|------|
| 单文件解析 | < 100ms | ✅ |
| 100 文件项目 | < 10 秒 | ✅ |
| 1000 文件项目 | < 60 秒 | 待验证 |
| UI 布局（100+ 节点） | < 1 秒 | ✅ |
| 搜索响应 | < 100ms | ✅ |

---

## 🗺️ Roadmap

- [x] Phase 1: 骨架 + Prisma ER 图
- [x] Phase 2: Next.js + tRPC 解析
- [x] Phase 3: React 组件 + API 调用
- [x] Phase 4: 跨层连线（calls_api）
- [x] Phase 5: 可视化打磨
- [x] Phase 6: MCP + CLI + 一致性检测
- [x] Phase 7: Demo + 发布
- [ ] 模块聚合（大图折叠）
- [ ] WebSocket 实时更新
- [ ] cal.com 端到端验证
- [ ] symbolResolver（handler→service→DB 链路追踪）

---

## 📄 License

MIT © 2026

---

<div align="center">

**如果你觉得这个项目有用，请给个 ⭐ Star！**

[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

</div>
