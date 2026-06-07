# CodeOmniVis 阶段报告书

> 生成日期：2026-06-06
> 扫描范围：全部 6 个包 + demo 目录 + 测试 + 文档

---

## 一、项目概况

| 指标 | 数值 |
|------|------|
| 包数量 | 6（shared / analyzer / server / ui / mcp / cli） |
| 源码总行数 | ~5,400 行（不含 demo 和文档） |
| 测试数量 | 80 个（全部通过） |
| 测试文件 | 9 个（全部在 analyzer 包） |
| 文档文件 | 16 个（9 个完整，7 个桩文件） |
| 支持的节点类型 | 9 种（page / component / api_route / trpc_procedure / express_route / handler / service / db_model / module） |
| 支持的边类型 | 9 种（renders / navigates_to / calls_api / handles / calls_service / queries_db / db_relation / imports / contains） |
| 解析器数量 | 8 个 |

### 各包代码量

| 包 | 行数 | 职责 |
|----|------|------|
| `shared` | ~600 | 类型定义、常量、工具函数 |
| `analyzer` | ~3,200 | 解析引擎（8 个解析器 + 3 个 resolver + 图构建 + 存储） |
| `server` | ~392 | Express REST API + WebSocket |
| `ui` | ~1,204 | React + Cytoscape.js 可视化 |
| `mcp` | ~196 | MCP Server（3 个工具） |
| `cli` | ~767 | CLI 入口（5 个命令） |

---

## 二、开发进度

### Phase 完成状态

| Phase | 内容 | 状态 | 备注 |
|-------|------|------|------|
| 1 | 骨架 + Prisma ER 图 | ✅ 完成 | |
| 2 | Next.js + tRPC 解析 | ✅ 完成 | |
| 3 | React 组件 + API 调用 | ✅ 完成 | |
| 4 | 跨层连线 | ✅ 完成 | Phase 1+2 计划已执行 |
| 5 | 可视化打磨 | ⚠️ 部分完成 | 布局算法仍在调优 |
| 6 | MCP + CLI + 一致性检测 | ⚠️ 部分完成 | MCP 工具返回空结果 |
| 7 | Demo + 发布 | ⚠️ 部分完成 | Demo 缺少关键文件 |

### 跨层连线进度（Phase 1+2 计划）

| 任务 | 状态 | 说明 |
|------|------|------|
| Task 1.1 ConsistencyReport 接口修复 | ✅ | `stats` → `summary` |
| Task 1.3 `linkHandles()` | ✅ | api_route/trpc/express → handler |
| Task 1.4 `linkCallsService()` | ✅ | handler → service（import 解析） |
| Task 1.5 `linkQueriesDb()` | ✅ | 正则扫描 + 符号追踪双模式 |
| Task 1.6 `linkAll()` 解除注释 | ✅ | 四个方法全部调用 |
| Task 2.1 `symbolResolver.ts` | ✅ | ts-morph 符号追踪，5 个测试通过 |
| Task 2.2 集成到 crossLayer | ✅ | async link()，tsConfigPath 参数 |
| Task 2.3 `findTsConfig()` | ✅ | 支持 monorepo 路径 |
| Task 2.4 性能保护 | ✅ | 超时 5s + 结果缓存 |
| Task 2.5 测试 | ✅ | 5 个测试全部通过 |

### Demo 项目实测结果（ByResume）

```
Files scanned: 62
Nodes: 73
Edges: 47

Node types:
  db_model: 7
  page: 9
  component: 48
  api_route: 9

Cross-layer links:
  calls_api: 4
```

### Demo 项目实测结果（CodeOmniVis Demo）

```
Files scanned: 16
Nodes: 23
Edges: 23

Node types:
  db_model: 6
  api_route: 2
  page: 4
  component: 11

Cross-layer links:
  handles:        3
  queries_db:     5
  calls_api:      0
  calls_service:  0
```

---

## 三、架构概览

```
┌─────────────────────────────────────────────────────┐
│  CLI (commander)                                      │
│  ┌──────┬──────────┬─────────┬─────────┬──────────┐  │
│  │ init │ analyze  │  check  │  serve  │   mcp    │  │
│  └──────┴──────────┴─────────┴────┬────┴──────────┘  │
├────────────────────────────────────┼──────────────────┤
│  Server (Express + ws)             │  MCP Server      │
│  REST API + WebSocket              │  3 tools         │
├────────────────────────────────────┴──────────────────┤
│  Analyzer Engine                                      │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Parsers (8)                                     │  │
│  │ Prisma / NextjsApp / NextjsPages / Trpc /       │  │
│  │ Express / Typeorm / ApiCalls / ReactComponent   │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ Resolvers (3)                                   │  │
│  │ PathAlias / CrossLayer / SymbolResolver         │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ Graph Builder + Consistency Checker             │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ Storage (sql.js / SQLite WASM)                  │  │
│  └─────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────┤
│  Shared Types (OmniNode / OmniEdge / OmniGraph)       │
├───────────────────────────────────────────────────────┤
│  UI (React + Cytoscape.js + fcose)                    │
└───────────────────────────────────────────────────────┘
```

### 数据流

```
项目文件 → Parsers → OmniNode[] + OmniEdge[]
    → GraphBuilder (去重 + 边验证)
    → OmniDatabase (SQLite)
    → CrossLayerLinker (跨层连线)
    → Server (REST API)
    → UI (Cytoscape.js 渲染)
```

---

## 四、技术债务

### 🔴 严重（影响功能正确性）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **MCP 数据库永远为空** | `mcp/src/index.ts` | MCP 三个工具全部返回空结果，AI 助手无法使用 |
| 2 | **MCP CLI 命令不启动服务器** | `cli/commands/mcp.ts` | `codeomnivis mcp` 命令实际不工作 |
| 3 | **`scanFileForDbCalls` 正则捕获组错误** | `crossLayer.ts:535` | `operation` 字段永远是 `undefined` |
| 4 | **`renders` 边跨文件 ID 不匹配** | `reactComponent.ts` | import 路径解析缺少扩展名，导致边被丢弃 |
| 5 | **Demo 不完整** | `demo/` | 缺少 `lib/trpc.ts`、`lib/prisma.ts`、`app/layout.tsx` |

### 🟡 中等（影响代码质量）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 6 | **`scanDirectory` 复制三份** | `analyze.ts` / `check.ts` / `serve.ts` | 维护风险，改一处要改三处 |
| 7 | **`analyze` 和 `check` 不运行 CrossLayerLinker** | CLI 命令 | 输出的图缺少跨层边，与 `serve` 不一致 |
| 8 | **`SymbolResolver` 并发竞态** | `symbolResolver.ts` | 共享 `visited` Set，并发追踪会互相干扰 |
| 9 | **`useCytoscape` hook 是死代码** | `ui/hooks/useCytoscape.ts` | GraphCanvas 自己管理 Cytoscape 实例 |
| 10 | **`useSearch` 误用 `useMemo`** | `ui/hooks/useSearch.ts:21` | 应该用 `useEffect`，违反 React 规则 |
| 11 | **`broadcastGraphUpdate` 是死代码** | `server/index.ts` | WebSocket 推送定义了但从未调用 |
| 12 | **Header 刷新按钮无事件** | `ui/components/Header.tsx:54` | 按钮是装饰性的，点击无反应 |
| 13 | **Prisma/TypeORM 关系边假设同文件** | `prisma.ts` / `typeorm.ts` | 跨文件关系的边 target ID 不匹配 |
| 14 | **`consistency.ts` 孤立节点类型错误** | `consistency.ts:130` | 用 `'unused_route'` 表示孤立节点，语义不对 |
| 15 | **`dbPath` 参数被忽略** | `storage/db.ts` | 构造函数接受路径但永远用内存数据库 |

### 🟢 低（代码风格 / 非功能性）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 16 | **`OmniNode` 缺少 `endLine`** | `shared/types/node.ts` | 无法高亮完整定义范围 |
| 17 | **`EdgeType` 缺少 `ImportsMetadata`** | `shared/types/edge.ts` | `imports` 边类型没有专属 metadata |
| 18 | **`FrameworkType` 与 Config 不对齐** | `shared/types/` | config 支持 `'react'` / `'vue'` 但 FrameworkType 不包含 |
| 19 | **`trpc_procedure` 不区分 router 和 procedure** | `trpc.ts` | 两种语义用同一个 NodeType |
| 20 | **UI 无 React Error Boundary** | `ui/App.tsx` | 组件崩溃导致白屏 |
| 21 | **DELETE `/api/graph` 无鉴权** | `server/routes/graph.ts` | 任何人都能清空数据库 |
| 22 | **`matchApiRoute` 未做 null check** | `crossLayer.ts` | metadata 缺少 `route` 属性时会抛异常 |

---

## 五、测试覆盖

### 覆盖率统计

| 模块 | 有测试 | 无测试 | 测试数 |
|------|--------|--------|--------|
| 解析器（8 个） | 5 | 3（nextjsPages / express / typeorm） | 44 |
| Resolver（3 个） | 3 | 0 | 13 |
| Storage | 1（db.ts） | 1（schema.ts） | 22 |
| Graph（builder + consistency） | 0 | 2 | 0 |
| Classifier | 0 | 1 | 0 |
| Server | 0 | 全部 | 0 |
| UI | 0 | 全部 | 0 |
| MCP | 0 | 全部 | 0 |
| CLI | 0 | 全部 | 0 |
| Shared | 0 | 全部 | 0 |
| **合计** | **9 个文件** | **大量** | **80** |

### 测试详情

| 测试文件 | 测试数 | 状态 |
|----------|--------|------|
| `parsers/prisma.test.ts` | 12 | ✅ 全通过 |
| `parsers/nextjsApp.test.ts` | 9 | ✅ 全通过 |
| `parsers/trpc.test.ts` | 8 | ✅ 全通过 |
| `parsers/apiCalls.test.ts` | 8 | ✅ 全通过 |
| `parsers/reactComponent.test.ts` | 7 | ✅ 全通过 |
| `resolver/pathAlias.test.ts` | 5 | ✅ 全通过 |
| `resolver/symbolResolver.test.ts` | 5 | ✅ 全通过 |
| `resolver/crossLayer.test.ts` | 3 | ✅ 全通过 |
| `storage/db.test.ts` | 22 | ✅ 全通过 |

---

## 六、文档状态

### 完整文档（9 个）

| 文件 | 内容 |
|------|------|
| `CLAUDE.md` | 项目指南（⚠️ 版本号过时） |
| `docs/README.md` | 文档索引 |
| `docs/plans/development-plan.md` | 7 阶段开发计划 |
| `docs/plans/PROJECT_STATUS.md` | 状态报告（⚠️ symbolResolver 标记为未实现） |
| `docs/plans/codeomnivis-phase1-phase2-plan.md` | Phase 1+2 实施计划 |
| `docs/rules/ai-development-rules.md` | AI 开发约束规则 |
| `docs/superpowers/specs/2026-06-06-codeomnivis-design.md` | 设计文档（~1500 行） |
| `docs/project-directory.md` | 目录结构（⚠️ 部分过时） |
| `docs/archive/项目大纲.md` | 原始大纲 |

### 桩文件（7 个，内容为"待编写"）

| 文件 | 应有内容 |
|------|----------|
| `docs/architecture/parser-pipeline.md` | 解析器执行流程 |
| `docs/architecture/visualization.md` | Cytoscape.js 配置详情 |
| `docs/architecture/data-model.md` | SQLite schema（部分完成） |
| `docs/api/rest-api.md` | REST API 端点规格 |
| `docs/api/mcp-tools.md` | MCP 工具定义 |
| `docs/demo/demo-project.md` | Demo 项目说明 |
| `docs/demo/cal-com-validation.md` | cal.com 验证结果 |

---

## 七、优先修复建议

### 立即修复（阻塞核心功能）

1. **MCP 工具返回空结果** — 需要在 MCP server 启动时执行项目解析，或共享 serve 命令的数据库
2. **MCP CLI 命令不工作** — `mcp.ts` 需要实际调用 MCP server 的启动函数
3. **`scanFileForDbCalls` 正则错误** — 修复捕获组，让 `operation` 字段正确赋值

### 短期优化（提升质量）

4. **提取 `scanDirectory` 为共享工具函数** — 消除三处重复
5. **`analyze` 和 `check` 命令加入 CrossLayerLinker** — 保证输出一致性
6. **修复 `reactComponent.ts` 路径扩展名问题** — 让 `renders` 边正确连接跨文件组件
7. **`SymbolResolver` 并发安全** — 将 `visited` 改为每次追踪的局部变量
8. **补充 Demo 缺失文件** — `lib/trpc.ts`、`lib/prisma.ts`、`app/layout.tsx`

### 中期改进（增强功能）

9. **UI 添加 Error Boundary** — 防止组件崩溃白屏
10. **修复 `useSearch` 的 `useMemo` 误用** — 改为 `useEffect`
11. **Header 刷新按钮绑定事件** — 调用 React Query 的 `refetch`
12. **WebSocket 推送实际接入** — 让 `broadcastGraphUpdate` 生效
13. **补充 3 个缺失解析器的测试** — nextjsPages / express / typeorm
14. **补充 graph 层测试** — builder.ts / consistency.ts

### 长期规划

15. **完善文档** — 填充 7 个桩文件
16. **更新 PROJECT_STATUS.md** — 反映 symbolResolver 已实现
17. **扩展框架检测** — 支持 React（非 Next.js）/ Vue / Svelte
18. **`DELETE /api/graph` 添加鉴权** — 至少加 token 验证
19. **并行化文件解析** — 提升大项目性能

---

## 八、依赖清单

### 运行时依赖

| 包 | 依赖 |
|----|------|
| shared | 无 |
| analyzer | `ts-morph`、`typescript`、`@prisma/internals`、`sql.js` |
| server | `express`、`cors`、`ws` |
| ui | `react`、`react-dom`、`cytoscape`、`cytoscape-dagre`、`cytoscape-fcose`、`@tanstack/react-query` |
| mcp | `@modelcontextprotocol/sdk` |
| cli | `commander`、`ora`、`chalk`、`open` |

### 开发依赖

| 工具 | 版本 |
|------|------|
| pnpm | 9.0.0 |
| turbo | 2.9.16 |
| typescript | 5.9.3 |
| tsup | 8.5.1 |
| vite | 5.4.21 |
| vitest | 1.6.1 |

---

## 九、总结

### 做得好的

- ✅ 类型系统完整，9 种节点 + 9 种边全部有专属 metadata
- ✅ 所有解析器遵循"降级而非崩溃"原则
- ✅ 跨层连线 Phase 1+2 全部完成，queries_db 边已生效
- ✅ 测试 80/80 全通过
- ✅ Monorepo 架构清晰，包依赖链合理

### 需要改进的

- ⚠️ MCP 包完全不可用（空数据库 + 未启动）
- ⚠️ 测试覆盖率低（仅 analyzer 包有测试，其他 5 个包零测试）
- ⚠️ 7 篇文档是桩文件
- ⚠️ Demo 项目不完整，缺少关键文件
- ⚠️ 存在 22 个已识别的技术债务项

### 下一步重点

1. **让 MCP 工作** — 这是 AI 助手集成的核心
2. **修复跨文件 ID 不匹配** — 这是边数量少的根本原因
3. **补充测试** — 至少覆盖 server 和 cli 包
4. **完善 Demo** — 让新用户能一键体验
