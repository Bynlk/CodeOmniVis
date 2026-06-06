# OmniVis 项目状态评估报告

> 评估日期：2026-06-06
> 评估依据：计划书 vs 实际代码逐项验证 + ByResume 项目实测

---

## 一、总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 核心功能 | ⭐⭐⭐⭐ 80% | 跨层连线已生效，三层可视化基本完整 |
| 代码质量 | ⭐⭐⭐⭐ 85% | 遵循降级原则，错误处理良好 |
| 解析器覆盖 | ⭐⭐⭐⭐ 80% | 8 个解析器全部实现，部分有 TODO 桩 |
| UI 交互 | ⭐⭐⭐ 70% | 搜索/过滤已连接，但 Cmd+K 仅聚焦无弹窗 |
| 文档完整度 | ⭐⭐ 40% | 核心文档存在，7 个文件标记"未编写" |
| 测试覆盖 | ⭐⭐⭐ 60% | analyzer 包有测试，其他包无测试 |
| 发布准备度 | ⭐⭐⭐ 60% | private 已移除，无 CI/CD、无 GIF |

**综合完成度：约 70%**

---

## 二、计划书 vs 实际完成度

### Phase 1：骨架 + Prisma ER 图 ✅ 95%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 1.1 monorepo 骨架 | pnpm workspace + turbo | 完整实现 | ✅ |
| 1.2 shared 包 | 7 个类型文件 | 8 个文件（含 defaults.ts） | ✅ |
| 1.3 存储层 | better-sqlite3 | sql.js（WASM，跨平台兼容） | ✅ 偏差 |
| 1.4 Prisma 解析器 | getDMMF + 关系提取 | 完整实现 | ✅ |
| 1.5 图构建器 | 去重 + 验证 | 完整实现 | ✅ |
| 1.6 Web 服务 | Express + REST API | 完整实现 + WebSocket | ✅ |
| 1.7 UI 基础 | Cytoscape.js | 完整实现 + 8 个额外组件 | ✅ |
| 1.8 CLI 基础 | serve 命令 | 完整实现 + 4 个额外命令 | ✅ |

### Phase 2：Next.js + tRPC 解析 ✅ 85%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 2.1 文件分类器 | classifyFile | 完整实现 | ✅ |
| 2.2 App Router 解析器 | nextjsApp.ts | 完整实现 | ✅ |
| 2.3 Pages Router 解析器 | nextjsPages.ts | 已实现 | ✅ 本次修复 |
| 2.4 tRPC 解析器 | createTRPCRouter | 已实现 + contains 边 | ✅ 本次修复 |
| 2.5 Express 解析器 | app.get/post | 已实现 | ✅ 本次修复 |
| 2.6 API 调用识别 | fetch/axios/tRPC | 完整实现 | ✅ |

### Phase 3：React 组件 + API 调用 ✅ 75%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 3.1 React 组件解析器 | JSX + import | 已实现 + props/state 提取 | ✅ 本次修复 |
| 3.2 TypeORM 解析器 | @Entity 装饰器 | 已实现 | ✅ 本次修复 |
| 3.3 组件树构建 | renders 边 | 完整实现 | ✅ |

### Phase 4：跨层连线 ✅ 60%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 4.1 路径别名解析 | tsconfig paths | 完整实现 | ✅ |
| 4.2 跨文件符号追踪 | symbolResolver.ts | ❌ 未实现 | ❌ |
| 4.3 跨层连线 | 4 种边类型 | calls_api 已集成，其余 3 种未实现 | ⚠️ |
| 4.4 monorepo 支持 | monorepo.ts | ❌ 未实现（仅检测） | ❌ |

**关键缺口**：
- `symbolResolver.ts` 不存在 → 无 handler→service→DB 调用链
- `crossLayer.ts` 仅实现 `linkCallsApi`（1/4），`handles`、`calls_service`、`queries_db` 被注释

### Phase 5：可视化打磨 ✅ 65%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 5.1 分层布局 | dagre TB | 已实现，无类型分层 | ⚠️ |
| 5.2 模块聚合 | 展开/折叠 | ❌ 未实现 | ❌ |
| 5.3 节点详情面板 | 右侧抽屉 | 完整实现 | ✅ |
| 5.4 搜索过滤 | Cmd+K | 搜索框已连接，无弹窗 | ⚠️ |
| 5.5 深色主题 | Linear 风格 | 通过 Tailwind 实现 | ✅ |
| 5.6 实时更新 | WebSocket | 服务端有基础，客户端未实现 | ⚠️ |

### Phase 6：MCP + CLI + 一致性检测 ✅ 75%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 6.1 MCP Server | 3 个工具 | 完整实现 | ✅ |
| 6.2 一致性检测 | 4 种检查 | 已实现 5 种（含 2 种新增） | ✅ 本次修复 |
| 6.3 CLI 完整命令 | 5 个命令 | 已实现 5 个 | ✅ 本次修复 |

### Phase 7：Demo + 发布 ⚠️ 50%

| 步骤 | 计划 | 实际 | 状态 |
|------|------|------|------|
| 7.1 自建 demo | 全栈项目 | 已扩充为全栈（页面+组件+tRPC+API） | ✅ 本次修复 |
| 7.2 cal.com 验证 | 端到端测试 | ❌ 未执行 | ❌ |
| 7.3 发布准备 | README + GIF | README 存在，无 GIF/截图 | ⚠️ |

---

## 三、ByResume 项目实测结果

### 分析数据

```
项目：ByResume（Next.js + Prisma 简历构建器）
文件扫描：62 个
节点：73 个
  - db_model: 7（User, Profile, Post, Comment, Tag, Booking, Session）
  - page: 9（首页、编辑器、管理后台、关于、联系等）
  - component: 48（Header, ResumeEditor, AIAssistantPanel 等）
  - api_route: 9（admin/stats, ai/chat, feedback, export-pdf 等）
边：28 条
  - db_relation: 16（模型间关系）
  - renders: 3（组件渲染关系）
  - calls_api: 9（组件→API 调用，其中 4 条跨层连线）
```

### 跨层连线验证

| 组件 | → | API 路由 | 置信度 |
|------|---|----------|--------|
| AdminDashboard | → | /api/feedback | inferred |
| PasswordModal | → | /api/admin/verify-password | inferred |
| SettingsModal | → | /api/admin/change-password | inferred |
| ExportMenu | → | /api/export-pdf | inferred |

### 一致性检测结果

```
总问题数：72
严重：0
警告：0
信息：72

主要问题类型：
- 未使用路由：9 个 API 路由无入边
- 孤立节点：63 个节点无任何连接
```

---

## 四、本次修复清单

### 新增文件（19 个）

| 文件 | 说明 |
|------|------|
| `packages/analyzer/src/parsers/nextjsPages.ts` | Next.js Pages Router 解析器 |
| `packages/analyzer/src/parsers/express.ts` | Express 路由解析器 |
| `packages/analyzer/src/parsers/typeorm.ts` | TypeORM Entity 解析器 |
| `packages/cli/src/commands/mcp.ts` | MCP CLI 命令 |
| `demo/app/page.tsx` | Demo 首页 |
| `demo/app/booking/page.tsx` | 预订列表页 |
| `demo/app/booking/[id]/page.tsx` | 预订详情页 |
| `demo/app/profile/page.tsx` | 用户资料页 |
| `demo/app/api/booking/route.ts` | 预订 API |
| `demo/app/api/user/route.ts` | 用户 API |
| `demo/server/routers/booking.ts` | tRPC booking router |
| `demo/server/routers/user.ts` | tRPC user router |
| `demo/components/Hero.tsx` | Hero 组件 |
| `demo/components/Footer.tsx` | Footer 组件 |
| `demo/components/BookingList.tsx` | 预订列表组件 |
| `demo/components/BookingDetail.tsx` | 预订详情组件 |
| `demo/components/UserProfile.tsx` | 用户资料组件 |
| `demo/components/Navigation.tsx` | 导航组件 |
| `demo/components/SearchBar.tsx` | 搜索栏组件 |

### 修改文件（14 个）

| 文件 | 修改内容 |
|------|----------|
| `packages/cli/src/commands/serve.ts` | 集成 CrossLayerLinker + 注册 8 个解析器 |
| `packages/cli/src/commands/analyze.ts` | 注册 8 个解析器 + 文件扫描逻辑 |
| `packages/cli/src/commands/check.ts` | 注册 8 个解析器 + ConsistencyChecker |
| `packages/cli/src/index.ts` | 注册 mcp 命令 |
| `packages/analyzer/src/parsers/index.ts` | 导出 8 个解析器 |
| `packages/analyzer/src/index.ts` | 导出 8 个解析器 |
| `packages/analyzer/src/parsers/trpc.ts` | 添加 router→procedure 的 contains 边 |
| `packages/analyzer/src/parsers/reactComponent.ts` | 提取 props（参数类型）+ 检测 useState |
| `packages/analyzer/src/parsers/typeorm.ts` | 修复 findDecorator 类型签名 |
| `packages/analyzer/src/graph/consistency.ts` | 添加 method_mismatch + missing_procedure 检测 |
| `packages/analyzer/src/graph/builder.ts` | calls_api 边跳过 source/target 验证 |
| `packages/analyzer/src/resolver/crossLayer.ts` | 修复 URL 提取逻辑 + source ID 匹配 |
| `packages/ui/src/components/GraphCanvas.tsx` | 接受 filteredNodes prop 控制显示 |
| `packages/ui/src/App.tsx` | 传 filteredNodes 给 GraphCanvas |
| `packages/ui/src/components/Header.tsx` | 添加 Cmd+K 快捷键聚焦搜索框 |
| 所有 `packages/*/package.json` | 移除 `private: true` |

---

## 五、剩余缺口

### P1 — 影响核心体验

| 缺口 | 影响 | 工作量 |
|------|------|--------|
| `symbolResolver.ts` 未实现 | 无 handler→service→DB 调用链追踪 | 2-3 天 |
| `crossLayer.ts` 仅 1/4 方法 | 无 `handles`、`calls_service`、`queries_db` 边 | 1-2 天 |
| 模块聚合未实现 | 大图（100+ 节点）无法折叠 | 1-2 天 |
| WebSocket 客户端未实现 | 无实时更新（文件变更→图更新） | 1 天 |

### P2 — 影响完整性

| 缺口 | 影响 | 工作量 |
|------|------|--------|
| analyze/check 仅注册 PrismaParser | 这两个命令检测不到前端/API 节点 | 已修复 |
| demo 无 cal.com 验证 | 未知大项目兼容性 | 1 天 |
| 无 GIF/截图 | README 无法展示效果 | 0.5 天 |
| 无 CI/CD | 无法自动发布 | 0.5 天 |
| 7 个文档未编写 | 开发者无法了解架构 | 1-2 天 |

### P3 — 锦上添花

| 缺口 | 影响 | 工作量 |
|------|------|--------|
| ReactComponent props 提取不完整 | 仅提取函数参数，未处理 interface 类型 | 0.5 天 |
| tRPC 嵌套 router 未递归 | 子 router 不展开 | 0.5 天 |
| 无动画过渡 | 布局切换无平滑效果 | 0.5 天 |
| 搜索无弹窗（Cmd+K） | 仅聚焦输入框，无命令面板 | 0.5 天 |

---

## 六、技术债务

| 项目 | 严重度 | 说明 |
|------|--------|------|
| sql.js 替代 better-sqlite3 | 低 | 跨平台兼容，性能略低 |
| 路径别名手动匹配 | 中 | 未使用 ts.resolveModuleName，可能漏解 |
| ConsistencyReport 接口不一致 | 低 | checker 用 `stats`，shared 类型用 `summary` |
| calls_api 边跳过验证 | 中 | 允许无效边存入数据库，依赖 CrossLayerLinker 修复 |
| 无增量解析 | 中 | 每次全量扫描，大项目慢 |

---

## 七、项目当前概况

### 基本信息

| 项目 | 值 |
|------|-----|
| 名称 | OmniVis |
| 版本 | 0.0.1 |
| 许可证 | MIT |
| Node 要求 | >=18.0.0 |
| 包管理器 | pnpm@9.0.0 |
| 源码总行数 | ~9,104 行（82 个文件） |

### Monorepo 结构

```
omnivis/
├── packages/
│   ├── shared/       # 共享类型（8 文件，768 行）
│   ├── analyzer/     # 解析引擎（20 文件，4,771 行）
│   ├── server/       # Express 服务（3 文件，392 行）
│   ├── ui/           # React + Cytoscape（14 文件，1,134 行）
│   ├── mcp/          # MCP Server（1 文件，196 行）
│   └── cli/          # CLI 入口（8 文件，767 行）
├── demo/             # 全栈 demo 项目（18 文件，339 行）
├── docs/             # 文档
└── 配置文件          # turbo.json, pnpm-workspace.yaml 等
```

### 包依赖关系

```
shared  (无内部依赖)
  ↑
analyzer  (依赖: shared)
  ↑
  ├── server  (依赖: shared, analyzer)
  │     ↑
  │     └── cli  (依赖: shared, analyzer, server)
  │
  ├── mcp  (依赖: shared, analyzer)
  │
  └── ui  (依赖: shared)
```

### 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 解析核心 | ts-morph + @prisma/internals | AST 分析 + Prisma DMMF |
| 图存储 | sql.js (WASM SQLite) | 本地零配置存储 |
| 可视化 | React + Cytoscape.js + dagre | 大图渲染 + 分层布局 |
| Web 服务 | Express + ws | REST API + WebSocket |
| MCP | @modelcontextprotocol/sdk | AI 助手接口 |
| CLI | commander + ora + chalk | 命令行工具 |
| 构建 | tsup (包) + Vite (UI) | 打包 |
| 样式 | Tailwind CSS | UI 样式 |

### 解析器清单（8 个）

| 解析器 | 文件 | 行数 | 状态 |
|--------|------|------|------|
| PrismaParser | `parsers/prisma.ts` | 235 | ✅ 完整 |
| NextjsAppParser | `parsers/nextjsApp.ts` | 305 | ✅ 完整 |
| NextjsPagesParser | `parsers/nextjsPages.ts` | 292 | ✅ 新增 |
| TrpcParser | `parsers/trpc.ts` | 266 | ✅ 含 contains 边 |
| ExpressParser | `parsers/express.ts` | 255 | ✅ 新增 |
| TypeormParser | `parsers/typeorm.ts` | 324 | ✅ 新增 |
| ApiCallsParser | `parsers/apiCalls.ts` | 334 | ✅ 完整 |
| ReactComponentParser | `parsers/reactComponent.ts` | 299 | ✅ 含 props/state |

### CLI 命令（5 个）

| 命令 | 文件 | 功能 |
|------|------|------|
| `omnivis serve` | `commands/serve.ts` | 启动 Web 服务 + 自动分析 |
| `omnivis analyze` | `commands/analyze.ts` | 分析项目输出 JSON |
| `omnivis check` | `commands/check.ts` | 一致性检测报告 |
| `omnivis mcp` | `commands/mcp.ts` | 启动 MCP Server |
| `omnivis init` | `commands/init.ts` | 生成配置文件 |

### UI 组件（10 个）

| 组件 | 文件 | 功能 |
|------|------|------|
| GraphCanvas | `components/GraphCanvas.tsx` | Cytoscape.js 图容器 |
| Header | `components/Header.tsx` | 顶部导航 + 搜索框 |
| Sidebar | `components/Sidebar.tsx` | 左侧节点列表 |
| NodeDetailPanel | `components/NodeDetailPanel.tsx` | 右侧详情面板 |
| NodeTypeFilter | `components/NodeTypeFilter.tsx` | 节点类型过滤器 |
| useGraph | `hooks/useGraph.ts` | 数据获取 hook |
| useSearch | `hooks/useSearch.ts` | 搜索过滤 hook |
| useCytoscape | `hooks/useCytoscape.ts` | Cytoscape 实例管理 |
| graphTransform | `utils/graphTransform.ts` | 图数据转换 |
| cytoscapeConfig | `utils/cytoscapeConfig.ts` | Cytoscape 样式配置 |

### 数据模型

**节点类型（9 种）**：`page`、`component`、`api_route`、`trpc_procedure`、`express_route`、`handler`、`service`、`db_model`、`module`

**边类型（9 种）**：`renders`、`navigates_to`、`calls_api`、`handles`、`calls_service`、`queries_db`、`db_relation`、`imports`、`contains`

**节点 ID 格式**：`{type}:{filePath}:{name}`（如 `db_model:prisma/schema.prisma:User`）

### 测试覆盖

| 包 | 测试文件数 | 测试行数 | 覆盖范围 |
|----|-----------|---------|---------|
| analyzer | 8 | 1,032 | parsers、resolver、storage |
| server | 0 | 0 | ❌ |
| ui | 0 | 0 | ❌ |
| mcp | 0 | 0 | ❌ |
| cli | 0 | 0 | ❌ |

### 文档清单

| 文件 | 状态 |
|------|------|
| `README.md` | ✅ 存在（无 GIF） |
| `CLAUDE.md` | ✅ 完整 |
| `docs/development-plan.md` | ✅ 完整 |
| `docs/ai-development-rules.md` | ✅ 完整 |
| `docs/project-directory.md` | ✅ 完整 |
| `docs/design-spec.md` | ✅ 完整 |
| `docs/architecture/*` | ❌ 未编写（3 个文件） |
| `docs/api/*` | ❌ 未编写（2 个文件） |
| `docs/demo/*` | ❌ 未编写（2 个文件） |

### 关键命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 启动开发模式
pnpm --filter @omnivis/cli dev serve

# 全局使用
omnivis serve      # 启动可视化服务
omnivis analyze    # 输出 JSON 图数据
omnivis check      # 一致性检测
omnivis mcp        # 启动 MCP Server
omnivis init       # 生成配置文件
```

---

## 八、结论

### 做得好的部分

1. **monorepo 架构清晰** — 6 个包职责明确，依赖链合理
2. **降级原则贯彻** — 所有解析器 try-catch，不崩溃
3. **类型系统完善** — 9 种节点类型、9 种边类型、完整 metadata
4. **UI 组件丰富** — 超出计划的 8 个额外组件
5. **跨层连线已生效** — 核心卖点基本可用

### 需要改进的部分

1. **symbolResolver 未实现** — 无法追踪 handler→service→DB 链路
2. **模块聚合缺失** — 大图体验差
3. **WebSocket 仅服务端** — 实时更新形同虚设
4. **测试覆盖不足** — 仅 analyzer 包有测试
5. **文档缺失** — 7 个文件标记"未编写"

### 下一步建议

1. **短期（1-2 天）**：实现 symbolResolver.ts，补全 crossLayer.ts 的 3 个方法
2. **中期（3-5 天）**：实现模块聚合、WebSocket 客户端、GIF 录制
3. **长期（1 周）**：cal.com 端到端验证、CI/CD 配置、文档补全

---

*报告结束*
