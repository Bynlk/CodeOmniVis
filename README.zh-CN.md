<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/ui/public/brand/logo-mark-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="packages/ui/public/brand/logo-mark-light.svg">
  <img src="packages/ui/public/brand/logo-mark-light.svg" width="88" alt="CodeOmniVis COV 标志">
</picture>

# CodeOmniVis

### 看清你的全栈架构，把 AI 缺失的上下文补完整。

**零配置 TypeScript 架构可视化工具：在一个本地工作台里连接 Next.js 页面、React 组件、API、服务与数据库模型，并通过 MCP 把同一份架构图谱提供给 AI 编程助手。**

[![CI](https://github.com/Bynlk/CodeOmniVis/actions/workflows/ci.yml/badge.svg)](https://github.com/Bynlk/CodeOmniVis/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40bynlk%2Fcodeomnivis.svg)](https://www.npmjs.com/package/@bynlk/codeomnivis)
[![npm downloads](https://img.shields.io/npm/dm/%40bynlk%2Fcodeomnivis.svg)](https://www.npmjs.com/package/@bynlk/codeomnivis)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%E2%89%A518-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial-6F83FF.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/Bynlk/CodeOmniVis?style=social)](https://github.com/Bynlk/CodeOmniVis)

![CodeOmniVis TypeScript 架构工作台，展示聚焦后的 Next.js 依赖图与 React 组件图](docs/assets/readme/codeomnivis-workbench-hero.png)

[English](README.md) · **简体中文** · [文档导航](docs/README.md) · [Demo 指南](demo/README.md)

</div>

<a id="quick-start"></a>

## 快速开始

```bash
npx @bynlk/codeomnivis serve
```

在仓库根目录执行。CodeOmniVis 会检测项目、本地分析源码、打开工作台，并在文件变化后持续刷新图谱。

### 第一分钟能看到什么

| 结果       | 工作台中呈现的内容                                                     |
| ---------- | ---------------------------------------------------------------------- |
| 项目地图   | 带类型的页面、组件、API 路由、服务、数据库模型、测试及其关系           |
| 跨层链路   | 在静态证据存在时展示源码路径、行号、调用者、依赖关系与页面到数据库路径 |
| 质量信号   | Parser warning，以及确定性的一致性、安全、N+1 与 RSC 边界发现          |
| 实时上下文 | 工作台、CLI/REST 与 MCP 共用一份带版本的本地快照，并随文件变化刷新     |

<a id="why-codeomnivis"></a>

## 为什么需要 CodeOmniVis

Cursor、Claude Code 和 Cline 已经很擅长改文件、跑命令；它们真正容易丢失的是持续的系统上下文：一个页面到底命中了哪条 API、哪个 service 查询了哪个 model，以及一次修改会跨层影响到哪里。

CodeOmniVis 把仓库变成一张供人和工具共同查询的**全栈架构图谱**。它不是另一个 coding agent，也不会上传你的源码；它是现有开发工作流下面的架构上下文层。

当全局搜索已经不足以证明结构时，可以用它：

- 证明页面、组件、路由、服务与模型之间的连接；
- 通过置信度区分直接确认和模式推断的关系；
- 在源码位置查看确定性的一致性与安全发现；
- 让 AI 在提出跨层修改前先拿到结构证据。

<a id="workflows"></a>

## 三种工作流，一份图谱

### 1. 接手陌生仓库

先从系统轮廓理解大型 TypeScript 项目，再从模块概览进入完整图谱，最后聚焦单个节点，同时保留上下游关系。

### 2. 跨层追踪代码

沿着 Next.js 页面进入 React 组件，再经过 API Route 或 tRPC procedure、service，最终到达 Prisma model。检查器始终保留源文件与行号。

### 3. 给 AI 编程助手补充架构上下文

把 CodeOmniVis 作为 MCP server 运行。AI 客户端可以查询调用者、组件树、API 路由、数据库模型与端到端数据流，而不是只凭有限的 prompt 猜测系统结构。

<a id="how-it-works"></a>

## 架构图谱如何生成

![TypeScript 全栈架构图：连接 Next.js、React、API、服务、Prisma、CLI、REST 与 MCP](docs/assets/readme/typescript-full-stack-architecture-graph.svg)

CodeOmniVis 把源码解析为带类型的节点和关系，解析跨文件与跨层连接，再把一个带版本的 `ProjectSnapshot` 事务性保存到本地 `sql.js` 数据库。相同的 ID 与摘要通过三个公开入口投影：

- 用于分析、一致性检查与有界测试操作的 CLI；
- 由 REST API 与 WebSocket 驱动的 React + Cytoscape.js 工作台；
- 面向 AI 编程助手的 MCP Server。

每个 parser 都会在失败时降级为 warning，而不是让整个分析崩溃。所有写入图谱的边都具有存在的端点，并标记 `certain` 或 `inferred` 置信度。

<a id="product-evidence"></a>

## 真实产品能力

### 架构工作台

稳定的深色工作台会同时展示导航、资源浏览器、画布、检查器、数据新鲜度与图谱规模。Architecture、Requests、Data model、Tests 和 Quality 是同一已提交项目快照上的平级视图。

首屏图片来自真实 Demo：`BookingPage → BookingList → /api/booking`，并在右侧展示所选组件的源码位置和调用关系。

### 确定性质量发现

![CodeOmniVis 确定性代码质量发现，包含严重级别、说明和源码位置](docs/assets/readme/code-quality-findings.png)

Quality 不是 AI 总结。它结合 parser 诊断和确定性项目检查，包括未鉴权路由、无调用路由、未使用组件、RSC 边界风险与 N+1 查询模式。中英文说明来自结构化 issue 数据，原始 parser 错误保持原文。

这里展示的是带源码证据的 API 与数据库依赖可视化，而不是装饰性仪表盘。

### MCP 架构查询

![CodeOmniVis MCP Server 为 Cursor、Claude Code 和 Cline 提供本地代码库架构上下文](docs/assets/readme/mcp-ai-codebase-context.svg)

MCP Server 读取和工作台相同的本地图谱。客户端可以调用：

| 工具                 | 回答的问题                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `get_api_routes`     | 有哪些 API、tRPC、TSRPC 或 Express 入口，它们继续访问了什么？           |
| `get_component_tree` | 这个页面或组件渲染了什么？                                              |
| `find_callers`       | 谁调用了这个节点，哪些页面可能受到影响？                                |
| `list_db_models`     | 检测到了哪些 Prisma、TypeORM 或 Drizzle model？                         |
| `get_dataflow`       | 一个 model 如何经过 API 与 service 层流向 UI？                          |
| `get_test_coverage`  | 发现了哪些 suite、case 与 fixture，它们通过静态证据连接到哪些生产节点？ |

<a id="supported-stack"></a>

## 支持范围

支持度按证据分级，避免把“源码里存在 parser”误解成“所有生态成熟度相同”。

| 证据级别              | 当前覆盖                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Demo 已验证主路径     | Next.js App Router、Next.js Pages Router、React 组件、`fetch` / `axios`、Next.js Route Handler、tRPC、service、Prisma |
| Parser 与回归测试覆盖 | Express、NestJS controller/module/service、TSRPC、TypeORM、Drizzle                                                    |
| 静态测试智能          | Vitest、Jest、Playwright、Cypress、JUnit 4/5 与 Kotest 发现；Web、REST、CLI、MCP 共用投影                             |
| 实验性支持            | Kotlin 语法、Spring、Ktor、Room、Exposed；已注册进默认 pipeline 并有针对性测试，但真实项目广度较少                    |
| Workspace 发现        | pnpm workspace 与 Turborepo 源码目录发现；尚不是完整的多包联邦模型                                                    |

项目还会通过数据库模型节点与 relation 边生成 **Prisma ER 图**。当 TypeORM 与 Drizzle parser 能解析模型时，它们会复用相同的 `db_model` 抽象。

测试发现语义、置信度规则、默认不执行策略与 JUnit XML 安全限制见[测试智能指南](docs/guides/test-intelligence.md)。

<a id="cli"></a>

## CLI

### 可视化一个仓库

```bash
npx @bynlk/codeomnivis serve
```

分析其他本地目录，或者指定端口：

```bash
npx @bynlk/codeomnivis serve --project /absolute/path/to/repository --port 4321
```

### 生成图数据或运行检查

`analyze` 和 `check` 使用当前工作目录：

```bash
cd /absolute/path/to/repository
npx @bynlk/codeomnivis analyze --output codeomnivis-graph.json
npx @bynlk/codeomnivis check
```

### 命令速查

| 命令                                                                  | 用途                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `serve --project <path> [--port 4321] [--host localhost] [--no-open]` | 分析项目、启动工作台、监听文件并推送图更新                       |
| `analyze [-o codeomnivis-graph.json]`                                 | 将当前仓库图谱写入 JSON                                          |
| `check`                                                               | 输出 parser 诊断和确定性一致性发现                               |
| `mcp --project <path>`                                                | 启动 stdio MCP Server                                            |
| `test-import --project <path> --junit <file-or-glob>`                 | 在不执行测试的情况下导入有界 JUnit XML 结果                      |
| `test-run --project <path> --runner <name> [--timeout <ms>]`          | 显式运行一个枚举内的 test runner，并限制 shell、路径、时间与输出 |
| `init`                                                                | 生成 `.codeomnivis.json` 起始配置                                |

绑定非 loopback host 时，除 health 外的 REST/WebSocket 入口都需要 token。Bearer 客户端可直接使用，浏览器则一次性交换为短期 HttpOnly、SameSite=Strict session。推荐默认使用本机 loopback。

<a id="mcp"></a>

## MCP 配置

使用目标项目的绝对路径，把 CodeOmniVis 添加到兼容客户端：

```json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "npx",
      "args": ["-y", "@bynlk/codeomnivis", "mcp", "--project", "/absolute/path/to/repository"]
    }
  }
}
```

如果目标项目还没有缓存，MCP 进程会先执行初次分析，并把数据库保存到 `~/.codeomnivis/projects/{hash}.db`。输入参数与响应结构见 [MCP 工具契约](docs/api/mcp-tools.md)。

<a id="api"></a>

## REST API 与实时更新

`serve` 在同一 origin 上提供工作台和本地 API。常用入口包括：

- `GET /api/health`
- `GET /api/graph`
- `GET /api/graph/nodes`
- `GET /api/graph/edges`
- `GET /api/graph/stats`
- `GET /api/graph/errors`
- `GET /api/graph/issues`
- `GET /api/graph/dataflow`
- `GET /api/tests`
- `POST /api/analyze`
- `GET /api/project` 与 `POST /api/project`
- `POST /api/ai/chat` 与 `POST /api/ai/explain`
- `ws://<host>:<port>/ws` 的 `graph_updated` 事件

详情见 [REST API 文档](docs/api/rest-api.md)。浏览器 UI 使用相同的端点，并在分析更新后一起失效 graph、quality、project 和 freshness 查询。

AI 路由只会在请求显式提供 `config`，或服务端设置 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 时调用 OpenAI 兼容的 `/chat/completions` 上游。未配置时返回 `AI_NOT_CONFIGURED`（`501`）；已配置请求仍受目标地址校验、响应大小、超时、按身份限流与并发限制保护。架构查询的推荐 AI 集成仍是 MCP。

<a id="limitations"></a>

## 已知限制

- 跨层关系来自静态分析；动态 import、运行时依赖注入、生成代码与元编程仍可能无法解析。
- Monorepo 目前能发现相关 workspace 源码目录，但还不是完整的多包联邦图谱。
- Kotlin、Spring、Ktor、Room 与 Exposed 属于实验性支持，真实项目覆盖少于 TypeScript Demo 主路径。
- 测试 `covers` 边表示静态源码证据，不是运行时行覆盖率；动态名称、反射、自定义 DSL 扩展与运行时参数行仍可能无法解析。
- `.codeomnivis.json` 是可选覆盖层，但不同命令的配置消费还没有完全统一。
- AI 代理路由是可选能力并要求显式凭据；Web UI 继续专注架构探索，MCP 是 AI agent 获取架构上下文的主要入口。
- 超大型仓库可能超过 60 秒。60 秒是支持范围内、合理规模项目的目标，而不是强制超时。

<a id="development"></a>

## 本地开发

### 环境要求

- Node.js `>= 18`
- pnpm `9`

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

从源码启动内置 Demo：

```bash
node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open
```

| 包                                       | 职责                                         |
| ---------------------------------------- | -------------------------------------------- |
| [`packages/shared`](packages/shared)     | 共享图谱、issue、配置与协议类型              |
| [`packages/analyzer`](packages/analyzer) | Parser、跨层解析、图构建、质量检查与本地存储 |
| [`packages/server`](packages/server)     | REST API、WebSocket、项目切换与增量分析      |
| [`packages/ui`](packages/ui)             | React + Cytoscape.js 架构工作台              |
| [`packages/mcp`](packages/mcp)           | stdio MCP Server 与架构查询工具              |
| [`packages/cli`](packages/cli)           | 公共命令入口与自包含发行包                   |
| [`demo`](demo)                           | 用于截图和集成测试的确定性全栈 fixture       |

更多资料：[项目目录](docs/project-directory.md)、[解析流水线](docs/architecture/parser-pipeline.md)、[图数据模型](docs/architecture/data-model.md)和[可视化架构](docs/architecture/visualization.md)。

<a id="roadmap"></a>

## 路线图

- 更强的多包和 monorepo 建模；
- 面向超大图的聚合与渐进展开；
- 为实验性 parser 增加更多真实项目 fixture；
- 在保持确定性的前提下增强影响分析；
- 可复现的公共发布与包来源说明。

<a id="faq"></a>

## 常见问题

### CodeOmniVis 是 local-first 吗？

是。分析、图数据库、工作台和 MCP 都在你的机器上运行，不需要托管账号。`serve` 默认只绑定 loopback；如果暴露到非 loopback 地址，必须配置访问 token。

### 它会上传或修改我的源码吗？

核心分析器只读取受支持的项目文件，不会修改或上传源码，也不收集遥测。可选的 `/api/ai/*` 路由只有在你配置 OpenAI 兼容服务后才会发出上游请求；使用时，该次请求中的消息与选定上下文会发送给你选择的服务商。MCP 架构查询仍在本地完成。

### 图谱有多准确？

它提供的是静态分析证据，不是运行时 trace。直接解析出的关系标记为 `certain`，启发式匹配标记为 `inferred`，parser 缺口会变成 warning。动态 import、依赖注入、生成代码和元编程仍可能无法解析。

### MCP 如何工作？

CodeOmniVis 以本地 stdio MCP Server 运行，查询工作台使用的同一份 `ProjectSnapshot`。在客户端配置目标项目的绝对路径；如果没有缓存，MCP 进程会先执行一次本地分析。

### 可以商业使用吗？

仓库采用 PolyForm Noncommercial License 1.0.0。学习、研究、个人及其他非商业用途可以使用；商业用途需要另行取得维护者许可。

<a id="contributing"></a>

## 参与贡献

欢迎贡献。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，遵守 [Code of Conduct](CODE_OF_CONDUCT.md)，安全问题请按 [SECURITY.md](SECURITY.md) 提交。

新增或修改 parser 时，请同时提供聚焦 fixture，以及正常、异常与边界测试。

<a id="license"></a>

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)。仓库可用于学习、研究、个人及其他非商业用途；商业使用需要另行获得许可。
