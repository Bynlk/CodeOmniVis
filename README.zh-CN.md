<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/ui/public/brand/logo-mark-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="packages/ui/public/brand/logo-mark-light.svg">
  <img src="packages/ui/public/brand/logo-mark-light.svg" width="72" alt="CodeOmniVis COV 标志">
</picture>

# CodeOmniVis

### 动手修改之前，先看清页面到数据库的完整路径。

**本地优先的 TypeScript 架构可视化工具：在同一个工作台里连接 Next.js 页面、React 组件、API、服务、数据库模型、测试及其关系。**

[English](README.md) · **简体中文** · [文档导航](docs/README.md) · [Demo 指南](demo/README.md)

<p align="center"><a href="https://github.com/Bynlk/CodeOmniVis/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Bynlk/CodeOmniVis/actions/workflows/ci.yml/badge.svg"></a> <a href="https://www.npmjs.com/package/@bynlk/codeomnivis"><img alt="npm version" src="https://img.shields.io/npm/v/%40bynlk%2Fcodeomnivis.svg"></a> <a href="https://nodejs.org/"><img alt="Node.js >= 18" src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933.svg"></a> <a href="LICENSE"><img alt="License: PolyForm Noncommercial" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-6F83FF.svg"></a></p>

</div>

<a id="quick-start"></a>

## 快速开始

在受支持项目的仓库根目录执行：

```bash
npx @bynlk/codeomnivis serve
```

CodeOmniVis 会在本地分析项目、打开工作台，并在源码变化后刷新图谱。默认流程不需要托管账号，也不需要预先编写配置文件。

![CodeOmniVis Focus 视图，从 BookingPage 经 BookingList 追踪到 booking API，并在 Inspector 展示源码证据](docs/assets/readme/codeomnivis-workbench-focus.jpg)

_真实内置 Demo：`BookingPage → BookingList → /api/booking`，右侧同时展示所选组件的源码位置、调用者和依赖。_

<a id="workflows"></a>

## 一张图谱，三种工作流

| 工作流                   | 可以回答什么                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| **理解陌生仓库**         | 在一个工作区查看 Next.js 页面、React 组件、API 路由、服务、测试和 Prisma ER 图。                 |
| **追踪跨层修改**         | 从页面沿组件、handler 和 service 进入 API 与数据库依赖，并保留源码路径与置信度。                 |
| **为 AI 补充架构上下文** | 通过 MCP 把同一份图谱提供给 Cursor、Claude Code 和 Cline，查询调用者、路由、模型、测试与数据流。 |

工作台、CLI/REST 和 MCP 共用一份带版本的项目快照，开发者看到的结构不会与 AI 编程助手拿到的上下文分裂成两套模型。

<a id="how-it-works"></a>

## 工作原理

![连接源码发现、已验证关系、工作台、CLI、REST 与 MCP 的全栈架构图](docs/assets/readme/typescript-full-stack-architecture-graph.svg)

CodeOmniVis 将受支持的源码解析为带类型的节点，解析跨文件和跨层关系，并把一个 `ProjectSnapshot` 保存到本地 `sql.js` 数据库。直接解析出的边标记为 `certain`，模式推断的证据标记为 `inferred`。单个 parser 失败会降级为 warning，不会中断完整分析。

<a id="supported-stack"></a>

## 支持范围

支持度按证据分级，避免把“存在 parser”误解成“所有生态成熟度相同”。

| 证据级别                  | 当前覆盖                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Demo 已验证主路径**     | Next.js App/Pages Router、React、`fetch`/`axios`、Route Handler、tRPC、service、Prisma |
| **Parser 与回归测试覆盖** | Express、NestJS controller/module/service、TSRPC、TypeORM、Drizzle                     |
| **静态测试智能**          | Vitest、Jest、Playwright、Cypress、JUnit 4/5、Kotest；Web、REST、CLI、MCP 共用投影     |
| **实验性支持**            | Kotlin 语法、Spring、Ktor、Room、Exposed；已有针对性测试，但真实项目广度较少           |

Workspace 发现支持 pnpm workspace 和 Turborepo 源码目录，但尚不是完整的多包联邦模型。测试发现、置信度和默认不执行语义见[测试智能指南](docs/guides/test-intelligence.md)。

<a id="mcp"></a>

## MCP 配置

在兼容客户端中指定需要分析的仓库：

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

MCP 读取工作台使用的同一份本地图谱；目标项目没有缓存时会先执行初次分析。参数和响应结构见 [MCP 工具契约](docs/api/mcp-tools.md)。

<a id="trust"></a>

## 信任边界与限制

- **本地优先：**分析、图数据库、工作台、CLI、REST 与 MCP 都在你的机器上运行。
- **源码处理：**分析器只读取受支持的项目文件，不会修改或上传源码，也不收集遥测。
- **可选 AI 出站：**只有配置 OpenAI 兼容服务后，`/api/ai/*` 才会发送消息和选定上下文；MCP 架构查询仍在本地完成。
- **静态证据：**动态 import、运行时依赖注入、生成代码、反射和元编程仍可能无法解析。
- **规模边界：**60 秒目标适用于受支持且规模合理的项目，并非所有仓库的硬性超时。
- **许可证：**学习、研究、个人及其他非商业用途可以使用；商业用途需要另行获得维护者许可。

完整接口行为见 [REST API 文档](docs/api/rest-api.md)。

<a id="development"></a>

## 本地开发

需要 Node.js `>=18` 和 pnpm `9`：

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

运行内置 fixture：`node packages/cli/bin/codeomnivis.js serve --project ./demo --no-open`。架构细节见[解析流水线](docs/architecture/parser-pipeline.md)、[图数据模型](docs/architecture/data-model.md)和[可视化设计](docs/architecture/visualization.md)。

<a id="contributing"></a>

## 参与贡献

从 [CONTRIBUTING.md](CONTRIBUTING.md) 开始，遵循[行为准则](CODE_OF_CONDUCT.md)，安全问题通过 [SECURITY.md](SECURITY.md) 报告。修改 parser 时应包含正常、异常和边界场景的聚焦 fixture。

<a id="license"></a>

## 许可证

[PolyForm Noncommercial License 1.0.0](LICENSE)。商业用途需要另行获得维护者许可。
