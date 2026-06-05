# CLAUDE.md — OmniVis 项目 Claude Code 工作指南

> 本文件是 Claude Code 在本项目中工作的唯一权威指南。
> 所有 AI 生成的代码必须遵守本文件和 `docs/rules/ai-development-rules.md` 中的规则。

---

## 项目概述

**OmniVis** 是一个零配置 CLI 工具，为 TypeScript 全栈项目（Next.js + tRPC/Express + Prisma/TypeORM）自动生成交互式拓扑图，连接前端组件、后端 API、数据库关系三层结构。

**核心卖点**：`npx omnivis serve` → 60 秒内看到整个项目的全栈架构图。

**目标**：GitHub 影响力优先。视觉效果 > 解析深度，demo 体验 > 功能完整性。

---

## 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 解析核心 | tree-sitter + ts-morph | tree-sitter 快速语法扫描，ts-morph 跨文件语义追踪 |
| DB 解析 | @prisma/internals | Prisma schema → DMMF |
| 图存储 | better-sqlite3 | 本地 SQLite，零配置 |
| 可视化 | React + Cytoscape.js + dagre | 大图渲染 + 分层布局 |
| Web 服务 | Express + ws | REST API + WebSocket |
| MCP | @modelcontextprotocol/sdk | AI 助手接口 |
| CLI | commander + ora + chalk | 命令行工具 |
| 构建 | tsup (包) + Vite (UI) | 打包 |
| 包管理 | pnpm workspace + Turborepo | monorepo |

---

## 项目结构

```
omnivis/
├── packages/
│   ├── shared/       # 共享类型（OmniNode, OmniEdge, OmniGraph）
│   ├── analyzer/     # 解析引擎（parsers/ + resolver/ + graph/ + storage/）
│   ├── server/       # Express Web 服务 + WebSocket
│   ├── ui/           # React + Cytoscape.js 可视化前端
│   ├── mcp/          # MCP Server（3 个工具）
│   └── cli/          # CLI 入口（serve/analyze/check/mcp/init）
├── demo/             # 自建 demo 项目
├── docs/             # 文档（specs/plans/rules/）
└── CLAUDE.md         # 本文件
```

**包依赖链**：`shared ← analyzer ← server ← cli`，`analyzer ← mcp`，ui 通过 REST API 访问 server。

---

## 开发阶段

当前阶段：**Phase 4 — 跨层连线**

详细计划见 `docs/plans/development-plan.md`。每个 Phase 开始前必须执行计划书中的验证规则。

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 骨架 + Prisma ER 图 | ✅ 完成 |
| 2 | Next.js + tRPC 解析 | ✅ 完成 |
| 3 | React 组件 + API 调用 | ✅ 完成 |
| 4 | 跨层连线 | ← 当前 |
| 5 | 可视化打磨 | 待开始 |
| 6 | MCP + CLI + 一致性检测 | 待开始 |
| 7 | Demo + 发布 | 待开始 |

---

## 核心规则（必须遵守）

### 1. 降级而非崩溃

所有解析器必须 try-catch，无法解析时返回空结果 + warning，不中断整个分析流程。

```typescript
// ✅ 正确
async function parse(file: string): Promise<ParseResult> {
  try {
    return { nodes: await doParse(file), edges: [], errors: [] }
  } catch (err) {
    return { nodes: [], edges: [], errors: [{ file, message: err.message, severity: 'warning' }] }
  }
}
```

### 2. 解析器统一接口

所有解析器必须实现：

```typescript
interface Parser {
  name: string
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean
  parse(filePath: string, context: ParseContext): Promise<ParseResult>
}
```

解析器之间不互相依赖，不直接访问存储。由 pipeline.ts 统一编排。

### 3. 节点 ID 格式

```
{type}:{filePath}:{name}
示例：db_model:prisma/schema.prisma:User
示例：page:app/booking/page.tsx:/booking
```

### 4. 边的 source/target 必须存在

插入边之前，必须验证 source 和 target 节点已存在。所有边必须标记 `confidence`（certain/inferred）。

### 5. 单一职责

每个文件只做一件事。每个组件文件 < 300 行。超过时拆分。

---

## 代码风格

- **文件名**：camelCase（`prisma.ts`、`symbolResolver.ts`）
- **类型名**：PascalCase（`OmniNode`、`ParseResult`）
- **函数名**：camelCase（`parsePrismaSchema`）
- **常量**：UPPER_SNAKE_CASE（`MAX_TRACE_DEPTH`）
- **接口**：不加 I 前缀
- **注释**：解释 WHY，不解释 WHAT
- **样式**：Tailwind CSS（UI 包）

---

## Git 规范

```
<type>(<scope>): <description>

type: feat | fix | refactor | test | docs | chore
scope: shared | analyzer | server | ui | mcp | cli | demo | docs

示例：
feat(analyzer): add Prisma schema parser
fix(resolver): handle circular imports gracefully
```

---

## 测试规范

- **单元测试**：`__tests__/fixtures/` 中的小型 fixture 文件，不依赖外部项目
- **集成测试**：可使用 `demo/` 或 cal.com 作为端到端测试
- **每个 parser 至少 3 个测试**：正常输入、异常输入、边界情况
- **测试文件位置**：`packages/analyzer/__tests__/parsers/prisma.test.ts`

---

## 性能目标

| 指标 | 目标 |
|------|------|
| 单文件解析 | < 100ms |
| 100 文件项目 | < 10 秒 |
| 1000 文件项目 | < 60 秒 |
| UI 布局（100+ 节点） | < 1 秒 |
| 搜索响应 | < 100ms |

---

## 关键命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 启动开发模式（Phase 1 完成后）
pnpm --filter @omnivis/cli dev serve

# 构建单个包
pnpm --filter @omnivis/analyzer build
```

---

## 工作流程（Claude Code 必须遵守）

### 开始任何任务前

1. 读取 `docs/plans/development-plan.md` 确认当前 Phase 和步骤
2. 读取 `docs/rules/ai-development-rules.md` 确认约束规则
3. 检查是否已有类似实现（避免重复）
4. 说明计划，再动手

### 生成代码后

1. 运行相关测试
2. 检查是否符合降级原则
3. 检查命名规范
4. 检查是否有必要的错误处理
5. 提交时使用规范的 commit message

### 遇到问题时

1. 记录问题到 `docs/plans/changelog.md`
2. 如果需要修改计划，先说明原因
3. 不强行执行不合理的计划

---

## 禁止行为

- ❌ 不经过思考就生成大量代码
- ❌ 不检查现有代码就重复实现
- ❌ 生成不符合项目风格的代码
- ❌ 跳过测试直接提交
- ❌ 修改计划书而不记录原因
- ❌ 在解析器中直接访问数据库
- ❌ 解析器之间互相 import

---

## Skills（专用开发指南）

| Skill | 适用场景 |
|-------|---------|
| `.claude/skills/parser-development.md` | 编写解析器时参考（模板、分工、测试） |
| `.claude/skills/cytoscape-visualization.md` | 实现 UI 可视化时参考（Cytoscape.js、React 封装） |
| `.claude/skills/mcp-server.md` | 实现 MCP Server 时参考（工具模板、返回格式） |
| `.claude/skills/sqlite-storage.md` | 实现存储层时参考（Schema、批量插入、查询） |
| `.claude/skills/monorepo-patterns.md` | 管理 monorepo 时参考（pnpm、Turborepo、包依赖） |
| `.claude/skills/testing-patterns.md` | 编写测试时参考（Vitest、fixture、mock） |
| `.claude/skills/error-handling.md` | 处理错误时参考（降级原则、错误级别） |

## 文档索引

| 文档 | 用途 |
|------|------|
| `docs/README.md` | 文档总索引 |
| `docs/superpowers/specs/2026-06-06-omnivis-design.md` | 设计文档 |
| `docs/plans/development-plan.md` | 开发计划（含验证规则） |
| `docs/rules/ai-development-rules.md` | AI 约束规则（详细版） |
| `docs/project-directory.md` | 完整目录结构 |

---

*本文件随项目进展更新。当前版本：Phase 1。*
