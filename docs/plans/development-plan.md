# CodeOmniVis 开发计划书

---

## ⚠️ 计划书验证规则（必读）

> **在执行任何开发步骤之前，必须完成以下验证：**

### 规则 1：可行性验证

在开始每个 Phase 之前，执行以下检查：

```
□ 检查该 Phase 依赖的所有前置 Phase 是否已完成并验收通过
□ 检查该 Phase 所需的第三方库是否已安装且版本兼容
□ 检查该 Phase 的验收标准是否明确、可测试
□ 如果发现计划不合理，立即修改计划而非强行执行
```

### 规则 2：执行度提升

每完成一个步骤后，执行以下优化：

```
□ 代码是否符合 ai-development-rules.md 中的所有约束？
□ 是否有遗漏的边界情况未处理？
□ 错误处理是否遵循"降级而非崩溃"原则？
□ 是否需要补充测试用例？
□ 该步骤的产出是否能独立运行和验证？
```

### 规则 3：计划修改流程

如果发现计划不合理：

```
1. 记录发现的问题（哪个步骤、什么问题、为什么不合理）
2. 提出修改建议
3. 修改本文档对应部分
4. 在 docs/plans/changelog.md 中记录修改历史
5. 继续执行修改后的计划
```

### 规则 4：验收标准

每个 Phase 的验收标准必须满足：

```
□ 可量化（不是"大致完成"，而是"输入 X，输出 Y"）
□ 可独立测试（不需要等所有 Phase 完成）
□ 有明确的通过/失败判定
```

---

## 开发总览

| Phase | 内容 | 预估天数 | 依赖 | 状态 |
|-------|------|---------|------|------|
| 1 | 骨架 + Prisma ER 图 | 3 天 | 无 | ✅ 完成 |
| 2 | Next.js + tRPC 解析 | 5 天 | Phase 1 | ✅ 完成 |
| 3 | React 组件 + API 调用 | 4 天 | Phase 1 | ✅ 完成 |
| 4 | 跨层连线 | 4 天 | Phase 2, 3 | ✅ 完成 |
| 5 | 可视化打磨 | 4 天 | Phase 4 | ✅ 完成 |
| 6 | MCP + CLI + 一致性检测 | 3 天 | Phase 4 | ✅ 完成 |
| 7 | Demo + 发布 | 3 天 | Phase 5, 6 | ✅ 完成 |
| **总计** | | **26 天** | | |

> 注：Phase 2 和 Phase 3 可以并行开发（都只依赖 Phase 1）。

---

## Phase 1：骨架 + Prisma ER 图

**目标**：能解析 Prisma schema 并生成 ER 图可视化。

### 步骤 1.1：初始化 monorepo 骨架

```
任务：
  - 创建根目录 package.json（pnpm workspace）
  - 创建 pnpm-workspace.yaml
  - 创建 turbo.json
  - 创建 tsconfig.base.json
  - 创建 .gitignore、.eslintrc.json、.prettierrc
  - 创建所有 packages/ 目录结构（空文件）

验收：
  □ pnpm install 能成功
  □ turbo build 能成功（即使包是空的）
```

### 步骤 1.2：实现 shared 包

```
任务：
  - 实现 types/node.ts（OmniNode、NodeType）
  - 实现 types/edge.ts（OmniEdge、EdgeType）
  - 实现 types/graph.ts（OmniGraph、ParseResult）
  - 实现 types/issue.ts（Issue、IssueSeverity）
  - 实现 types/config.ts（CodeOmniVisConfig）
  - 实现 constants/nodeColors.ts
  - 实现 index.ts 导出

验收：
  □ pnpm --filter @codeomnivis/shared build 成功
  □ 所有类型可以从 @codeomnivis/shared 正确导入
```

### 步骤 1.3：实现 analyzer 存储层

```
任务：
  - 实现 storage/schema.ts（SQLite 建表语句）
  - 实现 storage/db.ts（better-sqlite3 CRUD 封装）
  - 实现 storage/index.ts

验收：
  □ 能创建 SQLite 数据库
  □ 能插入和查询节点/边
  □ 单元测试通过
```

### 步骤 1.4：实现 Prisma 解析器

```
任务：
  - 实现 parsers/prisma.ts
  - 使用 @prisma/internals 的 getDMMF
  - 提取所有 Model → OmniNode
  - 提取所有 Relation → OmniEdge
  - 补全行号（grep 原始文件）

验收：
  □ 输入 cal.com 的 schema.prisma，输出正确的节点和边
  □ 关系类型（一对一、一对多、多对多）正确识别
  □ 单元测试通过
```

### 步骤 1.5：实现图构建器

```
任务：
  - 实现 graph/builder.ts
  - 合并 parser 输出，去重
  - 写入 SQLite

验收：
  □ 重复运行不会产生重复节点/边
  □ 节点 ID 格式正确
```

### 步骤 1.6：实现 Web 服务基础

```
任务：
  - 实现 server/src/index.ts（Express 入口）
  - 实现 server/src/routes/graph.ts（GET /api/graph）
  - 实现静态文件服务（serve UI 产物）

验收：
  □ curl http://localhost:4321/api/graph 返回 JSON
  □ 浏览器能访问 UI
```

### 步骤 1.7：实现 UI 基础

```
任务：
  - 初始化 Vite + React + Tailwind
  - 实现 GraphCanvas.tsx（Cytoscape.js 容器）
  - 实现 graphTransform.ts（API → Cytoscape 元素）
  - 实现 cytoscapeConfig.ts（ER 图样式）
  - 实现 useGraph.ts（数据获取 hook）
  - 实现 useCytoscape.ts（实例管理 hook）

验收：
  □ 浏览器显示 ER 图
  □ 节点可点击（console.log 即可）
  □ 边正确显示关系
```

### 步骤 1.8：实现 CLI 基础

```
任务：
  - 实现 cli/src/index.ts（Commander 入口）
  - 实现 cli/src/commands/serve.ts
  - 实现 cli/src/utils/autoDetect.ts（基础版：检测 prisma）
  - 实现 cli/src/utils/logger.ts

验收：
  □ npx codeomnivis serve 能启动服务
  □ 浏览器自动打开并显示 ER 图
```

### Phase 1 总验收

```
输入：任意包含 schema.prisma 的项目
输出：浏览器显示交互式 ER 图
时间：< 30 秒（小项目）
```

---

## Phase 2：Next.js + tRPC 解析

**目标**：能提取 Next.js 路由和 tRPC procedure。

### 步骤 2.1：实现文件分类器

```
任务：
  - 实现 classifier.ts
  - 根据文件路径和 package.json 依赖判断文件类型
  - 支持：nextjs_page、nextjs_api_route、trpc_router、express_route

验收：
  □ 能正确分类 cal.com 的文件
  □ 单元测试覆盖各种边界情况
```

### 步骤 2.2：实现 Next.js App Router 解析器

```
任务：
  - 实现 parsers/nextjsApp.ts
  - 扫描 app/ 目录提取 page.tsx 和 route.ts
  - 路径转换：app/booking/[id]/page.tsx → /booking/[id]
  - 提取 HTTP method（GET/POST/PUT/DELETE）
  - 处理 route groups（(group)/）和 parallel routes（@slot）

验收：
  □ 能提取 cal.com 的所有 App Router 路由
  □ 动态路由参数正确识别
  □ 单元测试通过
```

### 步骤 2.3：实现 Next.js Pages Router 解析器

```
任务：
  - 实现 parsers/nextjsPages.ts
  - 扫描 pages/ 目录
  - 区分 pages/api/（API 路由）和 pages/（页面路由）

验收：
  □ 能提取 Pages Router 的路由
  □ 与 App Router 不冲突
```

### 步骤 2.4：实现 tRPC 解析器

```
任务：
  - 实现 parsers/trpc.ts
  - 使用 ts-morph 解析 createTRPCRouter 调用
  - 递归解析嵌套 router
  - 提取 procedure 类型（query/mutation/subscription）
  - 提取 input/output schema 信息

验收：
  □ 能解析 cal.com 的 tRPC router
  □ 嵌套 router 正确合并
  □ procedure 类型正确识别
  □ 单元测试通过
```

### 步骤 2.5：实现 Express 路由解析器

```
任务：
  - 实现 parsers/express.ts
  - 识别 app.get/post/put/delete 调用
  - 识别 router.xxx 调用
  - 提取路由路径和 HTTP method

验收：
  □ 能提取 Express 路由定义
  □ 支持 router 级别的路由前缀
```

### 步骤 2.6：实现前端 API 调用识别

```
任务：
  - 实现 parsers/apiCalls.ts
  - 识别 fetch() 调用（提取 URL 和 method）
  - 识别 axios 调用
  - 识别 tRPC hooks（useQuery/useMutation）
  - 标记 confidence（certain/inferred）

验收：
  □ 能识别三种调用模式
  □ 模板字符串 URL 标记为 inferred
  □ tRPC hooks 调用标记为 certain
```

### Phase 2 总验收

```
输入：cal.com 项目
输出：所有 API 路由和 tRPC procedure 节点
附加：前端 API 调用边（未连接到后端，Phase 4 处理）
```

---

## Phase 3：React 组件 + API 调用

**目标**：能构建组件树并识别 API 调用。

### 步骤 3.1：实现 React 组件解析器

```
任务：
  - 实现 parsers/reactComponent.ts
  - ts-morph 提取 JSX 结构和 import 关系
  - 提取组件名、props、state 使用
  - 构建 parent → child 渲染关系

验收：
  □ 能识别函数组件和类组件
  □ import 关系正确解析
  □ JSX 子组件正确识别
```

### 步骤 3.2：实现 TypeORM 解析器

```
任务：
  - 实现 parsers/typeorm.ts
  - 识别 @Entity、@Column、@OneToMany 等装饰器
  - 提取实体节点和关系边

验收：
  □ 能解析 TypeORM entity 文件
  □ 关系装饰器正确识别
```

### 步骤 3.3：实现组件树构建

```
任务：
  - 在 graph/builder.ts 中添加组件树构建逻辑
  - 根据 import + JSX 使用关系构建 renders 边
  - 处理循环依赖（标记但不崩溃）

验收：
  □ 从页面节点开始，能遍历整棵组件树
  □ 循环依赖不会导致无限递归
```

### Phase 3 总验收

```
输入：包含 React 组件的项目
输出：组件树节点 + renders 边 + 每个组件的 API 调用
```

---

## Phase 4：跨层连线

**目标**：前端调用 → 后端路由 → DB 操作的完整链路。

### 步骤 4.1：实现路径别名解析

```
任务：
  - 实现 resolver/pathAlias.ts
  - 读取 tsconfig.json 的 paths 配置
  - 使用 ts.resolveModuleName 解析别名

验收：
  □ @/components/xxx 正确解析为绝对路径
  □ monorepo 中的包名正确解析
```

### 步骤 4.2：实现跨文件符号追踪

```
任务：
  - 实现 resolver/symbolResolver.ts
  - 从 API route handler 开始追踪
  - 识别 handler 调用的 service 函数
  - 识别 service 中的 prisma.xxx.findMany/create 等调用
  - 追踪深度限制（默认 5 层）
  - 循环检测

验收：
  □ handler → service → prisma 调用链正确
  □ 追踪深度限制生效
  □ 循环依赖不导致栈溢出
```

### 步骤 4.3：实现跨层连线

```
任务：
  - 前端 API 调用 → 后端路由匹配（calls_api 边）
  - 后端路由 → handler 函数（handles 边）
  - handler → service（calls_service 边）
  - service → DB model（queries_db 边）

验收：
  □ 至少 20 条准确的跨层连线
  □ confidence 标记正确
  □ 匹配算法处理路径变体（/api/booking vs booking.create）
```

### 步骤 4.4：实现 monorepo 支持

```
任务：
  - 实现 resolver/monorepo.ts
  - 检测 Turborepo / pnpm workspace
  - 识别包边界
  - 跨包 import 解析

验收：
  □ 能识别 monorepo 结构
  □ 跨包引用正确解析（或标记 inferred）
```

### Phase 4 总验收

```
输入：完整项目（前端 + 后端 + DB）
输出：三层连线图（前端 → API → DB）
附加：至少 20 条准确连线
```

---

## Phase 5：可视化打磨

**目标**：交互体验达到 demo 级别。

### 步骤 5.1：实现分层布局

```
任务：
  - 配置 dagre 布局（Top to Bottom）
  - 按节点类型分配层级（page → component → api → handler → db）
  - 动画过渡

验收：
  □ 前端节点在上，DB 节点在下
  □ 布局切换有平滑动画
```

### 步骤 5.2：实现模块聚合

```
任务：
  - 实现 graph/aggregator.ts
  - 按路由前缀/目录聚合节点
  - UI：点击模块展开/折叠

验收：
  □ 100+ 节点时默认显示 10-15 个模块
  □ 点击模块平滑展开
```

### 步骤 5.3：实现节点详情面板

```
任务：
  - 实现 NodeDetailPanel.tsx
  - 显示节点基本信息
  - 显示上游/下游节点列表
  - 跳转源码按钮（vscode:// 协议）

验收：
  □ 点击节点右侧弹出详情面板
  □ 上下游列表可点击跳转
```

### 步骤 5.4：实现搜索和过滤

```
任务：
  - 实现 CommandPalette.tsx（Cmd+K）
  - 实现 NodeTypeFilter.tsx
  - 实现 useSearch.ts

验收：
  □ Cmd+K 弹出搜索框
  □ 输入关键词实时过滤节点
  □ 左侧图例可切换节点类型显示
```

### 步骤 5.5：实现深色主题

```
任务：
  - 实现 theme.ts（Linear 风格配色）
  - 实现 globals.css
  - 节点颜色按类型区分

验收：
  □ 整体视觉风格统一
  □ 节点颜色区分清晰
```

### 步骤 5.6：实现实时更新

```
任务：
  - 实现 ws.ts（WebSocket 服务端）
  - 实现 useWebSocket.ts（客户端）
  - 文件变更时增量更新图

验收：
  □ 修改文件后图自动更新
  □ 更新过程不丢失缩放/位置状态
```

### Phase 5 总验收

```
输入：100+ 节点的项目
输出：流畅的交互体验
关键指标：
  - 布局时间 < 1 秒
  - 搜索响应 < 100ms
  - 展开/折叠动画流畅
```

---

## Phase 6：MCP + CLI + 一致性检测

**目标**：工具完整可用。

### 步骤 6.1：实现 MCP Server

```
任务：
  - 实现 mcp/src/index.ts
  - 实现 tools/getApiRoutes.ts
  - 实现 tools/getComponentTree.ts
  - 实现 tools/findCallers.ts

验收：
  □ Cursor 能调用三个工具
  □ 返回格式符合 MCP 规范
```

### 步骤 6.2：实现一致性检测

```
任务：
  - 实现 graph/consistency.ts
  - 检测死链 API 调用
  - 检测未使用路由
  - 检测 HTTP method 不匹配
  - 检测 tRPC procedure 不存在

验收：
  □ 能检测出至少 1 个真实 issue
  □ issue 包含严重级别和位置信息
```

### 步骤 6.3：实现 CLI 完整命令

```
任务：
  - 实现 commands/analyze.ts
  - 实现 commands/check.ts
  - 实现 commands/mcp.ts
  - 实现 commands/init.ts
  - 实现 utils/progress.ts（ora 进度条）

验收：
  □ npx codeomnivis analyze 输出 JSON
  □ npx codeomnivis check 输出报告
  □ npx codeomnivis mcp 启动 MCP Server
  □ npx codeomnivis init 生成配置文件
```

### Phase 6 总验收

```
输入：完整项目
输出：
  - MCP Server 可被 Cursor 调用
  - 一致性检测报告
  - 所有 CLI 命令可用
```

---

## Phase 7：Demo + 发布

**目标**：可发布、可宣传。

### 步骤 7.1：构建自建 demo 项目

```
任务：
  - 创建 demo/ 目录
  - 包含 8-10 个 Prisma model
  - 包含 5-6 个页面路由
  - 包含 3-4 个 tRPC router
  - 包含 10+ 个 React 组件
  - 包含跨层调用链

验收：
  □ npx codeomnivis serve 在 demo 上 60 秒内出图
  □ 图包含所有三层节点和连线
```

### 步骤 7.2：cal.com 验证

```
任务：
  - 克隆 cal.com（固定 commit hash）
  - 运行 codeomnivis serve
  - 记录问题并修复
  - 固定 demo 用的 cal.com 版本

验收：
  □ cal.com 上能跑通核心功能
  □ 已知问题记录在 docs/demo/cal-com-validation.md
```

### 步骤 7.3：准备发布

```
任务：
  - 编写 README.md（含 GIF、截图、Quick Start）
  - 准备 npm 包配置
  - 创建 GitHub Release 脚本
  - 录制 30 秒 demo 视频

验收：
  □ npm publish --dry-run 成功
  □ README 有 GIF 和截图
  □ Quick Start 步骤可复现
```

---

## 依赖关系图

```
Phase 1 (骨架 + Prisma)
    ├── Phase 2 (Next.js/tRPC) ──┐
    └── Phase 3 (React 组件) ────┤
                                  ├── Phase 4 (跨层连线)
                                  │       ├── Phase 5 (可视化打磨) ──┐
                                  │       └── Phase 6 (MCP/CLI) ────┤
                                  │                                  └── Phase 7 (Demo/发布)
```

---

## 修改历史

| 日期 | 修改内容 | 原因 |
|------|---------|------|
| 2026-06-06 | 初始版本 | - |

---

*计划书结束*
