<div align="center">

# CodeOmniVis

**面向 TypeScript 全栈仓库的架构可视化与 AI 查询工具链**

**[English](README.en.md)** | 中文

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-00d4aa.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%E2%89%A518-339933.svg)](https://nodejs.org/)
[![pnpm 9](https://img.shields.io/badge/pnpm-9-f69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

一条命令，把页面、组件、API、RPC、数据库模型和跨层数据流放进同一张图里。

</div>

CodeOmniVis 会扫描 TypeScript / JavaScript 全栈项目，构建统一的架构图谱，并同时提供浏览器 UI、CLI、REST API、WebSocket 和 MCP Server。它的目标不是再做一份“漂亮截图”，而是给人和 AI 一份能真正拿来定位调用链、理解边界、追踪数据流的工程索引。

## 适用场景

- 接手陌生仓库时，先看清页面、组件、接口、模型和依赖边界
- 做重构、拆包、迁移前，确认谁在调用谁、哪些页面会受影响
- 给 Cursor、Claude 或其他 AI 客户端提供真实的架构上下文
- 在日常开发中保留一份可搜索、可过滤、会随文件变更刷新的项目地图

## 当前能力

| 模块 | 当前可用内容 |
| --- | --- |
| CLI | `serve`、`analyze`、`check`、`mcp`、`init` |
| UI | 图谱画布、搜索、筛选、节点详情、数据流、问题列表、统计面板 |
| Server | `GET /api/graph*`、`POST /api/analyze`、`GET /api/health`、`ws://.../ws` |
| MCP | `get_api_routes`、`get_component_tree`、`find_callers`、`list_db_models`、`get_dataflow` |
| 缓存 | 使用 `sql.js` 持久化到 `~/.codeomnivis/projects/{hash}.db` |

> 当前仓库更适合“源码运行”场景：先在本仓库构建，再分析你的目标项目。

## 支持范围

| 维度 | 当前支持 |
| --- | --- |
| 前端 | Next.js App Router、Next.js Pages Router、React 组件树、`fetch` / `axios` 调用识别 |
| API / RPC | Next.js Route Handler、tRPC、TSRPC、Express、NestJS |
| 数据层 | Prisma、Drizzle、TypeORM |
| Kotlin 生态 | Spring Controller、Ktor Routing、Room、Exposed |
| 工程结构 | 对 `pnpm workspace` / Turborepo 做基础路径发现 |

> Monorepo 目前是“基础路径发现”，不是完整的多包联邦分析；更适合单仓库主应用或边界比较清晰的 workspace。

## 快速开始

### 1. 在当前仓库里跑 demo

```bash
pnpm install
pnpm build
node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open
```

然后打开 `http://localhost:4321`。

### 2. 分析任意本地仓库

```bash
node /absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js serve \
  --project /absolute/path/to/your-repo \
  --no-open
```

如果你已经把 CLI 放进 `PATH`，等价命令就是：

```bash
codeomnivis serve --project /absolute/path/to/your-repo --no-open
```

### 3. 生成离线图数据或做一致性检查

```bash
cd /absolute/path/to/your-repo
node /absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js analyze -o codeomnivis-graph.json
node /absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js check
```

`analyze` 和 `check` 当前按“当前工作目录”工作，所以最稳妥的方式是先 `cd` 到目标仓库根目录再执行。

## CLI 命令

| 命令 | 作用 | 说明 |
| --- | --- | --- |
| `serve --project <path> [--port 4321] [--host localhost] [--no-open]` | 启动可视化服务并做首轮分析 | 会启动文件监听、REST API 和 WebSocket |
| `analyze [-o codeomnivis-graph.json]` | 分析当前目录并输出图 JSON | 适合离线检查、存档、CI 产物 |
| `check` | 运行一致性检查 | 会输出统计、解析错误和一致性问题 |
| `mcp --project <path>` | 启动 stdio MCP Server | 供 AI 客户端查询架构 |
| `init` | 生成 `.codeomnivis.json` 起始文件 | 生成后建议按你的仓库结构手动调整 |

## UI / API 能看到什么

| 能力 | 说明 |
| --- | --- |
| 图谱画布 | 基于 React + Cytoscape.js，可浏览节点、边和整体结构 |
| 搜索与筛选 | 支持按节点类型、边类型、置信度和是否孤立节点过滤 |
| 节点详情 | 查看节点元信息、入边、出边以及跳转关系 |
| 数据流面板 | 以数据库模型为起点，追踪到 API 与消费组件 |
| 问题面板 | 展示解析错误列表 |
| 统计面板 | 展示节点/边分布与整体规模 |
| AI 面板 | 前端壳已接入，后端 `/api/ai/chat` 目前返回 `501`，仍是保留接口 |

服务端还提供一套直接可调用的接口：

- `GET /api/graph`
- `GET /api/graph/nodes`
- `GET /api/graph/nodes/:id`
- `GET /api/graph/edges`
- `GET /api/graph/stats`
- `GET /api/graph/errors`
- `GET /api/graph/dataflow`
- `POST /api/analyze`
- `GET /api/health`
- `ws://<host>:<port>/ws`，在图更新时推送 `graph_updated`

详细契约见 [docs/api/rest-api.md](docs/api/rest-api.md)。

## MCP 集成

CodeOmniVis 内置一个 stdio MCP Server，适合给 Cursor、Claude Desktop 或其他支持 MCP 的客户端补架构上下文。

### 工具列表

| 工具 | 适合问什么 |
| --- | --- |
| `get_api_routes` | 有哪些 API / tRPC / TSRPC 入口，哪些连到了数据库 |
| `get_component_tree` | 某个页面或组件会渲染出怎样的组件树 |
| `find_callers` | 谁在调用某个节点，哪些页面会被影响 |
| `list_db_models` | 当前项目有哪些数据库模型 |
| `get_dataflow` | 某个模型如何从 DB 走到 API，再走到 UI |

### 客户端配置示例

```json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "node",
      "args": [
        "/absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js",
        "mcp",
        "--project",
        "/absolute/path/to/your-repo"
      ]
    }
  }
}
```

首次启动时，如果对应项目还没有缓存数据库，MCP 会先跑一轮完整分析；后续查询会复用 `~/.codeomnivis/projects/{hash}.db`。

详细参数和返回结构见 [docs/api/mcp-tools.md](docs/api/mcp-tools.md)。

## 配置

`serve`、`analyze`、`check` 会读取项目根目录下的 `.codeomnivis.json`。下面这个例子使用的是当前运行时会识别的字段：

```json
{
  "frontend": {
    "dirs": ["app", "components"],
    "framework": "auto"
  },
  "backend": {
    "dirs": ["server", "api"],
    "framework": "trpc"
  },
  "database": {
    "prismaSchema": "prisma/schema.prisma",
    "typeormDirs": ["src/entities"]
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"],
  "port": 4321,
  "parser": {
    "maxTraceDepth": 5,
    "incremental": true
  },
  "ui": {
    "theme": "dark",
    "layout": "dagre",
    "aggregateThreshold": 100
  }
}
```

如果你只是想快速起一个模板，可以先执行：

```bash
codeomnivis init
```

然后再根据仓库实际目录结构调整。

## 仓库结构

| 目录 / 包 | 职责 |
| --- | --- |
| [`packages/shared`](packages/shared) | 共享类型、配置、颜色和默认值 |
| [`packages/analyzer`](packages/analyzer) | 解析器、图构建、数据流追踪、一致性检查 |
| [`packages/server`](packages/server) | REST API、WebSocket、增量分析 |
| [`packages/ui`](packages/ui) | React + Cytoscape.js 可视化前端 |
| [`packages/mcp`](packages/mcp) | stdio MCP Server |
| [`packages/cli`](packages/cli) | 命令行入口和项目自动检测 |
| [`demo`](demo) | 一个用来验证图谱质量的全栈样例项目 |
| [`docs`](docs) | API、架构、状态报告和计划文档 |

更细的目录说明见 [docs/project-directory.md](docs/project-directory.md)。

## Demo

[`demo/`](demo) 不是展示页面，而是一份专门为图谱分析准备的样例仓库，包含：

- Next.js App Router 页面
- Route Handler API
- tRPC Router 文件
- React 组件树
- Prisma schema 与模型关系

跑通方式和可以重点观察的节点，见 [demo/README.md](demo/README.md)。

## 文档

- [文档导航](docs/README.md)
- [REST API](docs/api/rest-api.md)
- [MCP 工具说明](docs/api/mcp-tools.md)
- [项目目录结构](docs/project-directory.md)
- [项目状态报告](docs/PROJECT_STATUS_REPORT.md)
- [解析流水线](docs/architecture/parser-pipeline.md)
- [数据模型](docs/architecture/data-model.md)
- [可视化设计](docs/architecture/visualization.md)

## 开发

### 环境要求

- Node.js `>= 18`
- `pnpm@9`

### 常用命令

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

根仓库使用 `pnpm workspace` + `turbo` 管理多包构建。

## 路线图

- 更稳的多包 / monorepo 分析体验
- 大图的模块折叠与聚合视图
- 更完整的 AI 工作流，而不只是暴露 MCP 查询
- 更多框架和语言生态支持
- 更完整的示例、截图和发布文档

## 参与贡献

- 开发说明见 [CONTRIBUTING.md](CONTRIBUTING.md)
- 社区行为规范见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 安全问题提交流程见 [SECURITY.md](SECURITY.md)

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

这意味着仓库默认面向学习、研究、个人和非商业场景。商业使用需要额外授权。
