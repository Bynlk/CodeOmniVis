# CodeOmniVis — 全栈架构可视化引擎 设计文档

> **文档版本**：v1.0
> **日期**：2026-06-06
> **状态**：设计阶段

---

## 1. 设计决策记录

### 1.1 核心目标

**GitHub 影响力优先**：视觉效果 > 解析深度，demo 体验 > 功能完整性。

### 1.2 关键决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 解析策略 | ts-morph 统一解析 | TypeScript AST 解析、跨文件语义追踪 |
| Demo 策略 | 自建 demo 先行 + cal.com 验证 | 可控、无外部依赖、快速出效果 |
| MVP 范围 | 全部解析器（含 Express/TypeORM） | 用户选择保留，确保覆盖面 |
| 开发模式 | AI 驱动开发 | 需要严格约束规则 |
| 可视化 | Cytoscape.js + dagre 布局 | 专为大图设计，性能好 |
| 存储 | better-sqlite3 | 零配置、零依赖 |
| 包管理 | pnpm monorepo | 与 Turborepo 项目一致 |

### 1.3 分工策略

```
ts-morph 负责：
  - TypeScript/JSX AST 解析
  - 跨文件符号追踪（import 解析）
  - tRPC router 深度分析
  - Express 路由模式匹配
  - 路径别名解析

@prisma/internals 负责：
  - Prisma schema 解析（DMMF）
```

---

## 2. 架构设计

### 2.1 系统分层

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Entry Point                       │
│              packages/cli/src/index.ts                   │
└──────────────┬──────────────────┬───────────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌────────────────────────┐
│   Analysis Engine    │  │     Web Server          │
│  packages/analyzer/  │  │  packages/server/       │
│                      │  │  Express + WebSocket    │
│  ┌────────────────┐  │  └────────────┬───────────┘
│  │ Parser Layer   │  │               │
│  │ (ts-morph)     │  │               ▼
│  │                │  │  ┌────────────────────────┐
│  └───────┬────────┘  │  │   Visualization UI      │
│          │           │  │   packages/ui/          │
│  ┌───────▼────────┐  │  │   React + Cytoscape.js  │
│  │ Resolver Layer │  │  └────────────────────────┘
│  │ (跨文件追踪)    │  │
│  └───────┬────────┘  │  ┌────────────────────────┐
│          │           │  │   MCP Server            │
│  ┌───────▼────────┐  │  │   packages/mcp/         │
│  │  Graph Builder │  │  └────────────────────────┘
│  └───────┬────────┘  │
│          │           │
│  ┌───────▼────────┐  │
│  │  SQLite Store  │  │
│  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 包依赖关系

```
shared ← analyzer ← server ← cli
                  ← mcp
                  ← ui (通过 server REST API)
```

### 2.3 数据流

```
文件系统 → Parser Layer → OmniNode[] / OmniEdge[]
                ↓
         Resolver Layer → 补全跨文件边
                ↓
         Graph Builder → 去重 + 聚合 + 一致性检测
                ↓
         SQLite Store → 持久化
                ↓
         REST API → UI / MCP Server
```

---

## 3. 数据模型

### 3.1 节点类型

```typescript
type NodeType =
  | 'page'           // Next.js 页面路由
  | 'component'      // React 组件
  | 'api_route'      // Next.js API Route
  | 'trpc_procedure' // tRPC procedure
  | 'express_route'  // Express 路由
  | 'handler'        // 路由 handler
  | 'service'        // Service 层
  | 'db_model'       // Prisma Model / TypeORM Entity
  | 'module'         // 聚合节点
```

### 3.2 边类型

```typescript
type EdgeType =
  | 'renders'        // 组件渲染关系
  | 'navigates_to'   // 页面导航
  | 'calls_api'      // 前端 API 调用
  | 'handles'        // 路由处理
  | 'calls_service'  // Handler → Service
  | 'queries_db'     // Service → DB Model
  | 'db_relation'    // DB 关系
  | 'imports'        // 模块导入
  | 'contains'       // 聚合关系
```

### 3.3 节点 ID 格式

```
{type}:{filePath}:{name}
示例：db_model:prisma/schema.prisma:User
示例：page:app/booking/page.tsx:/booking
示例：trpc_procedure:server/routers/booking.ts:booking.create
```

---

## 4. 分阶段开发计划

### Phase 1：骨架 + Prisma ER 图（3 天）

**目标**：能解析 Prisma schema 并生成 ER 图可视化。

**产出**：
- monorepo 骨架搭建（pnpm workspace + turbo）
- shared 包：所有类型定义
- analyzer 包：Prisma 解析器 + 图构建
- server 包：基础 Express + REST API
- ui 包：Cytoscape.js 基础 ER 图渲染
- CLI：`npx codeomnivis serve` 能跑

**验收标准**：
- 输入一个 `schema.prisma` 文件
- 浏览器显示 ER 图，节点可点击
- 边正确显示关系类型

### Phase 2：Next.js + tRPC 解析（5 天）

**目标**：能提取 Next.js 路由和 tRPC procedure。

**产出**：
- Next.js App Router 解析器
- Next.js Pages Router 解析器
- tRPC router 解析器（支持嵌套）
- Express 路由解析器
- 前端 API 调用识别（fetch/axios/tRPC hooks）

**验收标准**：
- 能提取 cal.com 的所有 API 路由
- tRPC procedure 正确识别类型（query/mutation）
- Express 路由正确提取 HTTP method

### Phase 3：React 组件 + API 调用（4 天）

**目标**：能构建组件树并识别 API 调用。

**产出**：
- React 组件解析器（ts-morph 提取 JSX 和 import）
- 组件树构建（parent → child 关系）
- API 调用提取（fetch/axios/tRPC hooks）
- TypeORM entity 解析器

**验收标准**：
- 能显示从页面到子组件的树结构
- 每个组件的 API 调用被正确识别
- TypeORM 装饰器正确解析

### Phase 4：跨层连线（4 天）

**目标**：前端调用 → 后端路由 → DB 操作的完整链路。

**产出**：
- SymbolResolver：跨文件符号追踪
- 前端 API 调用 → 后端路由匹配
- Handler → Service → DB 调用链追踪
- 路径别名解析（tsconfig paths）
- monorepo 包边界处理

**验收标准**：
- 至少 20 条准确的跨层连线
- confidence 标记正确（certain/inferred）
- 错误降级不崩溃

### Phase 5：可视化打磨（4 天）

**目标**：交互体验达到 demo 级别。

**产出**：
- 分层 dagre 布局（前端在上，DB 在下）
- 模块聚合视图（点击展开/折叠）
- 节点详情面板（右侧抽屉）
- 搜索功能（Cmd+K）
- 按类型过滤
- 上下游高亮
- 实时更新（WebSocket）
- 深色主题（Linear 风格）

**验收标准**：
- 100+ 节点时布局 < 1 秒
- 点击模块平滑展开
- 搜索实时响应

### Phase 6：MCP + CLI + 一致性检测（3 天）

**目标**：工具完整可用。

**产出**：
- MCP Server（3 个工具）
- `codeomnivis check` 命令
- `codeomnivis init` 命令
- 前后端接口一致性检测
- CLI 进度条和美化输出

**验收标准**：
- Cursor 能调用 `find_callers`
- `codeomnivis check` 输出 JSON 报告
- 死链 API 调用被检测到

### Phase 7：Demo + 发布（3 天）

**目标**：可发布、可宣传。

**产出**：
- 自建 demo 项目（完整三层结构）
- cal.com 实测验证
- README + 截图 + GIF
- npm 发布准备
- Demo 视频脚本

**验收标准**：
- `npx codeomnivis serve` 在自建 demo 上 60 秒内出图
- cal.com 上能跑通（至少核心功能）
- README 有 GIF 和截图

---

## 5. 技术风险与缓解

| 风险 | 概率 | 缓解方案 |
|------|------|----------|
| tRPC 嵌套 router 解析失败 | 高 | Phase 2 优先测试，降级为扁平 router 识别 |
| ts-morph monorepo 跨包追踪失败 | 中 | 降级为同包追踪，跨包标记 inferred |
| Cytoscape 大图性能问题 | 中 | Web Worker 布局，超时降级 grid |
| 60 秒目标超标 | 中 | SQLite 增量缓存，二次运行秒级 |
| path alias 解析不完整 | 高 | 失败时标记 inferred，不崩溃 |

### 降级原则

所有解析器遵循：**降级而非崩溃**。无法解析时返回空结果 + warning，不中断整个分析流程。

---

## 6. 不包含的功能（v2）

- XState 状态机分析
- 基础设施层（K8s/Docker）
- OpenTelemetry 运行时追踪
- 消息队列流
- 自然语言查询
- VS Code 扩展
- Python/Go/Vue/Angular 支持
- CI/CD 集成

---

*文档结束*
