<div align="center">

```
 ██████╗ ██████╗ ██████╗ ███████╗ ██████╗ ███╗   ███╗███╗   ██╗██╗██╗   ██╗██╗███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔═══██╗████╗ ████║████╗  ██║██║██║   ██║██║██╔════╝
██║     ██║   ██║██║  ██║█████╗  ██║   ██║██╔████╔██║██╔████╔██║██╔██╗ ██║██║██║   ██║██║███████╗
██║     ██║   ██║██║  ██║██╔══╝  ██║   ██║██║╚██╔╝██║██║╚██╗██║██║╚██╗ ██╔╝██║╚════██║
╚██████╗╚██████╔╝██████╔╝███████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║ ╚████╔╝ ██║███████║
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═══╝  ╚═╝╚══════╝
```

# 🔮 CodeOmniVis — Full-Stack Architecture Visualizer

**One command, 60 seconds, see your entire project architecture.**

Not just drawing — it's **code semantic understanding** × **cross-layer data flow tracing** × **AI-native integration**.

[![License: MIT](https://img.shields.io/badge/License-MIT-00d4aa.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-≥18-339933.svg)](https://nodejs.org/)

</div>

---

> `npx codeomnivis serve` on cal.com →
> **2,535 nodes · 4,592 edges · 15 seconds · zero config**

## What it maps

| Layer | cal.com coverage |
|-------|-----------------|
| Pages | 119 ✅ |
| API Routes | 82 ✅ |
| DB Models (Prisma/Drizzle) | 102 ✅ |
| Components | 1,349 ✅ |
| Frontend→API calls | 172 ✅ |
| Render relationships | 3,117 ✅ |

## Frameworks

Next.js · NestJS · Express · tRPC · **TSRPC**
Prisma · Drizzle · TypeORM · Kotlin Spring/Ktor

## AI Integration (MCP)

Works with Cursor and Claude Desktop out of the box.
`find_callers` · `get_api_routes` · `get_component_tree`

## Install

```bash
npx codeomnivis serve
```

---

## 🤯 TL;DR

> CodeOmniVis statically analyzes your TypeScript full-stack project, automatically generates a complete **frontend → API → database** topology graph,
> and detects dead code, circular dependencies, and data flow paths. Built-in MCP Server lets AI assistants understand your architecture directly.

---

## 🔥 Core Capabilities

### 1. Zero-Config Full-Stack Analysis

```bash
npx @bynlk/CodeOmniVis serve   # See full architecture in 60 seconds
```

Auto-detect frameworks → scan files → AST parsing → cross-layer linking → visualization. No configuration needed.

### 2. 22 Parsers, Covering the Ecosystem

<table>
<tr>
<td align="center" colspan="3"><b>Supported Frameworks</b></td>
</tr>
<tr>
<td><b>Frontend</b></td>
<td><b>Backend</b></td>
<td><b>Database</b></td>
</tr>
<tr>
<td>

✅ Next.js App Router<br/>
✅ Next.js Pages Router<br/>
✅ React component tree<br/>
✅ fetch / axios calls<br/>
✅ tRPC hooks

</td>
<td>

✅ tRPC Router<br/>
✅ Express routes<br/>
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

### 3. Not Just Topology — Architecture Intelligence

| Capability | Description |
|------|------|
| **Cross-layer linking** | `fetch('/api/user')` → `GET /api/user` → `User.findUnique()` → `User` table, full chain auto-linked |
| **Data flow tracing** | Select a Model, see which APIs and components consume it 🌊 |
| **Dead code detection** | 🚫 Routes with no callers, 🗑️ Components never rendered, 🔇 Services never used |
| **Circular dependency detection** | 🔄 Tarjan SCC algorithm, precise cycle identification |
| **Consistency checks** | Dead API links, HTTP method mismatches, missing tRPC procedures |

### 4. MCP Server — AI-Native Integration

```bash
codeomnivis mcp   # Start MCP Server
```

**5 tools** for Cursor / Claude / any AI assistant to query your architecture:

| Tool | Function | What AI can ask |
|------|------|------------|
| `get_api_routes` | API routes + downstream DB | "What APIs exist? Which connect to the database?" |
| `get_component_tree` | Component tree | "What components does the Booking page use?" |
| `find_callers` | Call chain tracing | "Who calls the User model?" |
| `list_db_models` | Database model list | "What tables exist?" |
| `get_dataflow` | Data flow tracing | "How does User data flow from DB to UI?" |

```
You: What's the authentication flow in this project?

AI (via CodeOmniVis):
  User → /api/auth → middleware → protectedProcedure → Session
  
  Complete call chain, not a guess.
```

---

## ⚡ Quick Start

```bash
# Global install
npm install -g @bynlk/CodeOmniVis

# Or run directly
npx @bynlk/CodeOmniVis serve
```

Browser opens automatically → see the full three-layer architecture → click nodes → search/filter/zoom.

### Commands

```bash
codeomnivis serve          # 🚀 Start visual server (auto-analysis + file watching)
codeomnivis analyze        # 📊 Output JSON graph data
codeomnivis check          # 🔍 Consistency check + dead code + circular deps
codeomnivis mcp            # 🤖 Start MCP Server
codeomnivis init           # ⚙️ Generate .codeomnivis.json config file
```

### Configuration (Optional)

```json
// .codeomnivis.json — works with zero config, config makes it more precise
{
  "frontend": { "dirs": ["src"], "framework": "next" },
  "backend": { "dirs": ["server"], "framework": "nestjs" },
  "database": { "prismaSchema": "prisma/schema.prisma" },
  "exclude": ["node_modules", "dist", ".next"]
}
```

---

## 🧠 What Can It Understand?

### Auto-Detection Output

```
$ codeomnivis serve --project ./cal.com

✔ Server running at http://localhost:4321

Scanning 9390 files...
Analysis results:
  Files scanned: 9,390
  Nodes: 1,892
  Edges: 3,347

Node types:
  component:      693   ← React components + props
  handler:        490   ← Route handlers
  trpc_procedure: 408   ← tRPC procedures
  page:           104   ← Page routes + dynamic params
  db_model:       102   ← Database models + relations
  api_route:       82   ← API routes + HTTP methods
  service:         13   ← Service layer

Edge types:
  renders:       1,622   ← Component render relationships
  handles:         490   ← Route handler bindings
  contains:        342   ← Module containment
  db_relation:     323   ← Database table relations
  calls_service:   311   ← Service call chains
  calls_api:       172   ← Frontend API calls
  queries_db:       87   ← Database queries
```

### Cross-Layer Linking

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

### Dead Code + Circular Dependency Detection

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

### Data Flow Tracing 🌊

```
Select Model: User

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
          │  · tRPC            │ │  Incremental│ │  · find_callers    │
          │  · TSRPC           │ │  File watch │ │  · list_db_models  │
          │  · Express         │ │             │ │  · get_dataflow    │
          │  · NestJS          │ └──────┬──────┘ └─────────┬─────────┘
          │  · Drizzle         │        │                  │
          │  · TypeORM         │        │                  │
          │  · Kotlin/Spring   │        │                  │
          │  · Ktor            │        │                  │
          │  · Exposed         │        │                  │
          │  · Room            │        │                  │
          │                    │        │                  │
          │  CrossLayerLinker  │        │                  │
          │  DataFlowTracer    │        │                  │
          │  ConsistencyChecker│        │                  │
          │  · Dead code det.  │        │                  │
          │  · Circular dep.   │        │                  │
          │  · Consistency     │        │                  │
          └────────┬───────────┘        │                  │
                   │                    │                  │
          ┌────────┴────────────────────┴──────────────────┴───┐
          │              SQLite (sql.js WASM)                   │
          │         ~/.codeomnivis/projects/{hash}.db               │
          │         Zero-config · File persistence · Cross-process │
          └────────────────────────┬───────────────────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │     Web UI         │
                         │  React + Cytoscape │
                         │  dagre layout      │
                         │  Search/Filter/Detail│
                         │  🌊 Data Flow Panel │
                         │  ⚠️ Issues Panel    │
                         │  📊 Stats Panel     │
                         └───────────────────┘
```

---

## 📦 Monorepo Structure

```
codeomnivis/
├── packages/
│   ├── shared/       # Shared types (17 node types + 15 edge types + config)
│   ├── analyzer/     # Analysis engine (22 parsers + graph algorithms + storage)
│   ├── server/       # Express + WebSocket + incremental analysis
│   ├── ui/           # React + Cytoscape.js + 6 tab panels
│   ├── mcp/          # MCP Server (5 tools, concurrent safe)
│   └── cli/          # 5 commands + auto-detection + config loading
├── demo/             # Full-stack demo project
└── docs/
    ├── plans/        # Four-week execution plans + Claude Code Prompts
    ├── architecture/ # Analysis pipeline, data model, visualization design
    ├── api/          # REST API + MCP tool docs
    ├── rules/        # AI development constraint rules
    └── reports/      # Status reports
```

| Package | Lines | Function |
|----|---------|------|
| `@codeomnivis/shared` | 995 | 17 node types, 15 edge types, config loader |
| `@codeomnivis/analyzer` | 9,557 | 22 parsers, data flow tracing, dead code/circular dep detection |
| `@codeomnivis/server` | 759 | REST API, WebSocket broadcast, file watch incremental analysis |
| `@codeomnivis/ui` | 2,328 | 6 tab panels, Cytoscape graph, data flow visualization |
| `@codeomnivis/mcp` | 411 | 5 MCP tools, concurrent safe, graceful shutdown |
| `@codeomnivis/cli` | 1,312 | 5 commands, config integration, auto framework detection |
| **Total** | **~15,362** | |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|----|------|-----------|
| Analysis core | **ts-morph** | Type-safe TypeScript AST analysis |
| DB parsing | **@prisma/internals** | Prisma official DMMF |
| Graph storage | **sql.js** (WASM SQLite) | Zero-config, zero-dependency, file persistence |
| Visualization | **React** + **Cytoscape.js** + **dagre** | Designed for large graphs, auto hierarchical layout |
| Web server | **Express** + **ws** | WebSocket real-time push |
| MCP | **@modelcontextprotocol/sdk** | AI assistant standard protocol |
| CLI | **commander** + **ora** + **chalk** | Elegant CLI experience |
| Build | **tsup** + **Vite** | ESM native, fast builds |
| Styling | **Tailwind CSS** | Dark theme |

---

## 🎯 Performance Benchmark (cal.com)

Verified on [cal.com](https://github.com/calcom/cal.com) (9,390 files, large full-stack project):

| Metric | Value |
|------|------|
| Files scanned | 9,390 |
| Nodes | 1,892 |
| Edges | 3,347 |
| Errors | 0 |

### Node Type Distribution

| Type | Count | Description |
|------|------|------|
| component | 693 | React components |
| handler | 490 | Request handlers |
| trpc_procedure | 408 | tRPC procedures |
| page | 104 | Page routes |
| db_model | 102 | Database models |
| api_route | 82 | API routes |
| service | 13 | Service layer |

### Edge Type Distribution

| Type | Count | Description |
|------|------|------|
| renders | 1,622 | Component render relationships |
| handles | 490 | Route handler bindings |
| contains | 342 | Module containment |
| db_relation | 323 | Database table relations |
| calls_service | 311 | Service call chains |
| calls_api | 172 | Frontend API calls |
| queries_db | 87 | Database queries |

### Code Quality

- **0 `any`** — Zero `any` in source code + test files
- **0 `this.db!`** — All replaced with type-safe `getDb()` helper
- **Degrade, don't crash** — All parsers try-catch, WASM failure doesn't crash
- **Incremental updates** — Graph diff updates, no full layout rebuilds

---

## 🗺️ Roadmap

### ✅ Completed

- [x] 22 parsers (Next.js / tRPC / TSRPC / Express / NestJS / Prisma / Drizzle / TypeORM / Kotlin)
- [x] Cross-layer linking (Frontend → API → Service → DB)
- [x] Data flow tracing (Model → API → Component)
- [x] Dead code detection (Dead routes / Dead components / Dead services)
- [x] Circular dependency detection (Tarjan SCC)
- [x] Consistency checks (Dead links / Method mismatches / Missing procedures)
- [x] MCP Server (5 tools)
- [x] Configuration file system (.codeomnivis.json)
- [x] File watch incremental analysis
- [x] WebSocket real-time push
- [x] 6 UI panels (Graph / Filter / Issues / Data Flow / AI / Stats)
- [x] Full code review (61 findings, 59 fixed)
- [x] Zero `any` type safety (74 → 0)
- [x] Degrade, don't crash (All parsers + database + WebSocket)
- [x] Performance optimization (Incremental layout, caching, no polling)

### 🔜 Future Goals

- [ ] Module aggregation (Large graph folding)
- [ ] AI conversational queries
- [ ] VS Code extension
- [ ] Monorepo multi-package analysis
- [ ] More framework support (Vue / Svelte / Fastify / Hono)

---

## 📄 License

MIT © 2026

---

<div align="center">

**If you find this project useful, give it a ⭐ Star!**

[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

</div>
