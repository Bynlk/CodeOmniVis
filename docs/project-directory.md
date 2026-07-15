# CodeOmniVis 完整项目目录结构

> **生成日期**：2026-06-06
> **说明**：标注 `# MVP` 的文件为第一阶段必须实现，其余为后续阶段

---

## 根目录

```
codeomnivis/
├── .github/
│   ├── workflows/
│   │   └── ci.yml                    # GitHub Actions CI
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docs/
│   ├── superpowers/                  # AI 辅助文档
│   │   ├── specs/
│   │   │   └── 2026-06-06-codeomnivis-design.md
│   │   ├── plans/
│   │   └── progress/
│   ├── plans/                        # 开发计划
│   │   └── development-plan.md
│   ├── rules/                        # AI 约束规则
│   │   └── ai-development-rules.md
│   ├── architecture/                 # 架构文档
│   │   ├── data-model.md
│   │   ├── parser-pipeline.md
│   │   └── visualization.md
│   ├── api/                          # API 文档
│   │   ├── rest-api.md
│   │   └── mcp-tools.md
│   └── demo/                         # Demo 相关
│       ├── demo-project.md
│       └── cal-com-validation.md
│
├── packages/
│   ├── shared/                       # 共享类型定义
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── node.ts           # OmniNode, NodeType
│   │   │   │   ├── edge.ts           # OmniEdge, EdgeType
│   │   │   │   ├── graph.ts          # OmniGraph, ParseResult
│   │   │   │   ├── issue.ts          # Issue, IssueSeverity
│   │   │   │   ├── config.ts         # CodeOmniVisConfig
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── nodeColors.ts     # 节点颜色配置
│   │   │   │   └── defaults.ts       # 默认配置值
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── analyzer/                     # 解析引擎
│   │   ├── src/
│   │   │   ├── index.ts              # 主入口，编排流水线 # MVP
│   │   │   │
│   │   │   ├── parsers/              # 各框架解析器
│   │   │   │   ├── prisma.ts         # Prisma schema 解析 # MVP
│   │   │   │   ├── typeorm.ts        # TypeORM entity 解析
│   │   │   │   ├── nextjsApp.ts      # Next.js App Router # MVP
│   │   │   │   ├── nextjsPages.ts    # Next.js Pages Router
│   │   │   │   ├── express.ts        # Express 路由解析
│   │   │   │   ├── trpc.ts           # tRPC router 解析 # MVP
│   │   │   │   ├── tsrpc.ts          # TSRPC 协议解析
│   │   │   │   ├── drizzle.ts        # Drizzle ORM 解析
│   │   │   │   ├── reactComponent.ts # React 组件解析 # MVP
│   │   │   │   ├── apiCalls.ts       # 前端 API 调用识别 # MVP
│   │   │   │   ├── nestjs/           # NestJS 解析器
│   │   │   │   ├── kotlin/           # Kotlin 解析器(Spring/Ktor/Room/Exposed)
│   │   │   │   └── index.ts          # 解析器注册表
│   │   │   │
│   │   │   ├── resolver/             # 跨文件符号追踪
│   │   │   │   ├── symbolResolver.ts # ts-morph 跨文件追踪 # MVP
│   │   │   │   ├── pathAlias.ts      # tsconfig paths 解析 # MVP
│   │   │   │   ├── crossLayer.ts     # 跨层连线
│   │   │   │   ├── dataFlowTracer.ts # 数据流追踪
│   │   │   │   ├── authDetector.ts   # 认证检测
│   │   │   │   ├── rscBoundaryDetector.ts
│   │   │   │   ├── nPlusOneDetector.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── graph/                # 图构建
│   │   │   │   ├── builder.ts        # 节点/边构建 + 去重 # MVP
│   │   │   │   ├── runFullAnalysis.ts # 全量分析入口
│   │   │   │   ├── runAnalysis.ts    # 增量分析入口
│   │   │   │   ├── consistency.ts    # 一致性检测
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── storage/              # 数据存储
│   │   │   │   ├── db.ts             # sql.js 封装 # MVP
│   │   │   │   ├── schema.ts         # SQL 建表语句 # MVP
│   │   │   │   ├── metadataGuards.ts # 存储边界元数据解析
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── classifier.ts         # 文件分类器 # MVP
│   │   │   └── types.ts              # 包内类型定义
│   │   │
│   │   ├── __tests__/
│   │   │   ├── parsers/
│   │   │   │   ├── prisma.test.ts
│   │   │   │   ├── nextjsApp.test.ts
│   │   │   │   ├── trpc.test.ts
│   │   │   │   └── reactComponent.test.ts
│   │   │   ├── resolver/
│   │   │   │   └── symbolResolver.test.ts
│   │   │   └── graph/
│   │   │       └── consistency.test.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── server/                       # Web 服务
│   │   ├── src/
│   │   │   ├── index.ts              # Express 服务入口 # MVP
│   │   │   ├── routes/
│   │   │   │   ├── graph.ts          # GET /api/graph # MVP
│   │   │   │   └── index.ts
│   │   │   ├── pathGuard.ts          # 路径安全校验
│   │   │   ├── middleware/
│   │   │   │   ├── cors.ts
│   │   │   │   └── errorHandler.ts
│   │   │   └── static.ts             # 静态文件服务（UI 产物）
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                           # 可视化前端
│   │   ├── src/
│   │   │   ├── App.tsx               # 根组件 # MVP
│   │   │   ├── main.tsx              # 入口 # MVP
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── Graph/
│   │   │   │   │   ├── GraphCanvas.tsx    # Cytoscape.js 容器 # MVP
│   │   │   │   │   ├── GraphToolbar.tsx   # 工具栏
│   │   │   │   │   ├── NodeTypeFilter.tsx # 节点类型过滤
│   │   │   │   │   └── Minimap.tsx        # 小地图
│   │   │   │   │
│   │   │   │   ├── Panel/
│   │   │   │   │   ├── NodeDetailPanel.tsx  # 节点详情抽屉 # MVP
│   │   │   │   │   ├── IssuePanel.tsx       # 一致性问题列表
│   │   │   │   │   └── StatsPanel.tsx       # 项目统计
│   │   │   │   │
│   │   │   │   ├── Search/
│   │   │   │   │   └── CommandPalette.tsx   # Cmd+K 搜索
│   │   │   │   │
│   │   │   │   ├── Sidebar/
│   │   │   │   │   ├── LayerSwitcher.tsx    # 视图层切换
│   │   │   │   │   └── Legend.tsx           # 图例
│   │   │   │   │
│   │   │   │   └── Layout/
│   │   │   │       ├── AppLayout.tsx        # 整体布局
│   │   │   │       └── Header.tsx           # 顶栏
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useGraph.ts         # 图数据获取 # MVP
│   │   │   │   ├── useWebSocket.ts     # 实时更新
│   │   │   │   ├── useSearch.ts        # 搜索逻辑
│   │   │   │   └── useCytoscape.ts     # Cytoscape 实例管理 # MVP
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── cytoscapeConfig.ts  # Cytoscape 初始化 # MVP
│   │   │   │   ├── graphTransform.ts   # API → Cytoscape 转换 # MVP
│   │   │   │   ├── layoutOptions.ts    # 布局配置
│   │   │   │   └── theme.ts            # 主题配置
│   │   │   │
│   │   │   └── styles/
│   │   │       ├── globals.css         # 全局样式
│   │   │       └── graph.css           # 图相关样式
│   │   │
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mcp/                          # MCP Server
│   │   ├── src/
│   │   │   ├── index.ts              # MCP Server 入口（含全部工具实现）
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                          # CLI 入口
│       ├── src/
│       │   ├── index.ts              # Commander 入口 # MVP
│       │   ├── commands/
│       │   │   ├── serve.ts          # npx codeomnivis serve # MVP
│       │   │   ├── analyze.ts        # npx codeomnivis analyze
│       │   │   ├── mcp.ts            # npx codeomnivis mcp
│       │   │   ├── check.ts          # npx codeomnivis check
│       │   │   └── init.ts           # npx codeomnivis init
│       │   └── utils/
│       │       ├── autoDetect.ts     # 框架自动检测 # MVP
│       │       ├── progress.ts       # 进度条（ora）
│       │       └── logger.ts         # chalk 日志
│       │
│       ├── bin/
│       │   └── codeomnivis.ts            # shebang 入口
│       ├── package.json
│       └── tsconfig.json
│
├── demo/                             # 自建 demo 项目
│   ├── prisma/
│   │   └── schema.prisma             # 8-10 个 model
│   ├── app/
│   │   ├── page.tsx                  # 首页
│   │   ├── booking/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── booking/
│   │   │   │   └── route.ts
│   │   │   └── user/
│   │   │       └── route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── booking/
│   │   │   ├── BookingList.tsx
│   │   │   ├── BookingForm.tsx
│   │   │   └── BookingDetail.tsx
│   │   ├── user/
│   │   │   └── UserProfile.tsx
│   │   └── shared/
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   ├── server/
│   │   ├── routers/
│   │   │   ├── booking.ts
│   │   │   └── user.ts
│   │   └── trpc.ts
│   ├── package.json
│   └── tsconfig.json
│
├── .codeomnivis.json.example             # 配置文件示例
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── LICENSE                           # PolyForm Noncommercial 1.0.0
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.base.json                # 基础 TS 配置
└── README.md
```

---

## 文件职责说明

### shared 包

| 文件                      | 职责                                                 |
| ------------------------- | ---------------------------------------------------- |
| `types/node.ts`           | 定义 `OmniNode`、`NodeType`、节点 metadata 类型      |
| `types/edge.ts`           | 定义 `OmniEdge`、`EdgeType`、边 metadata 类型        |
| `types/graph.ts`          | 定义 `OmniGraph`、`ParseResult`、`ProjectMeta`       |
| `types/issue.ts`          | 定义 `Issue`、`IssueSeverity`、`IssueType`           |
| `types/config.ts`         | 定义 `CodeOmniVisConfig`（.codeomnivis.json 的类型） |
| `constants/nodeColors.ts` | 节点类型 → 颜色映射（与 UI 主题一致）                |
| `constants/defaults.ts`   | 默认配置值（端口、追踪深度、聚合阈值等）             |

### analyzer 包

| 文件                         | 职责                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| `classifier.ts`              | 根据文件路径和内容判断文件类型（前端/后端/schema）                 |
| `parsers/prisma.ts`          | 使用 `@prisma/internals` 解析 schema → `OmniNode[]` + `OmniEdge[]` |
| `parsers/trpc.ts`            | 使用 ts-morph 解析 tRPC router → `OmniNode[]`                      |
| `parsers/nextjsApp.ts`       | 扫描 `app/` 目录提取页面和 API route                               |
| `parsers/reactComponent.ts`  | ts-morph 提取 JSX 结构和 import                                    |
| `parsers/apiCalls.ts`        | 识别 fetch/axios/tRPC hooks 调用                                   |
| `resolver/symbolResolver.ts` | ts-morph 跨文件符号追踪：handler → service → DB                    |
| `resolver/pathAlias.ts`      | 解析 tsconfig.json 中的 paths 配置                                 |
| `graph/builder.ts`           | 合并所有 parser 输出，去重，生成最终图                             |
| `graph/consistency.ts`       | 检测死链 API、未使用路由、method 不匹配                            |
| `storage/db.ts`              | sql.js CRUD 操作封装                                               |

### server 包

| 文件              | 职责                            |
| ----------------- | ------------------------------- |
| `routes/graph.ts` | 返回完整图数据（nodes + edges） |
| `pathGuard.ts`    | 路径遍历攻击防护                |

### ui 包

| 文件                  | 职责                                            |
| --------------------- | ----------------------------------------------- |
| `GraphCanvas.tsx`     | Cytoscape.js 容器，处理缩放/平移/点击事件       |
| `NodeDetailPanel.tsx` | 右侧抽屉，显示节点详情、上下游、跳转源码        |
| `CommandPalette.tsx`  | Cmd+K 搜索框，实时过滤节点                      |
| `graphTransform.ts`   | 将 REST API 返回的数据转换为 Cytoscape 元素格式 |
| `cytoscapeConfig.ts`  | Cytoscape 样式、布局、事件配置                  |

### mcp 包

| 文件       | 职责                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `index.ts` | MCP Server 入口，包含全部工具实现（getApiRoutes/getComponentTree/findCallers/listDbModels/getDataFlow） |

---

_目录结构文档结束_
