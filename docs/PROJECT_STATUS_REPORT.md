# CodeOmniVis 项目阶段报告

> 生成日期：2026-06-06
> 扫描范围：全量代码 + docs 计划书对比

---

## 一、项目概况

**CodeOmniVis** 是一个零配置 CLI 工具，为 TypeScript 全栈项目自动生成交互式拓扑图，连接前端组件、后端 API、数据库关系三层结构。

| 维度 | 状态 |
|------|------|
| 包数量 | 7 个（shared / analyzer / server / ui / mcp / cli / demo） |
| 源文件数 | ~60 个（不含 dist/node_modules） |
| 测试用例 | 80 个（全部通过） |
| 构建状态 | ✅ 全量构建通过 |
| 综合完成度 | **~70%** |

---

## 二、各包完成度

| 包 | 职责 | 完成度 | 说明 |
|----|------|--------|------|
| **shared** | 类型定义 + 常量 | 95% | 类型体系完整，9 种节点 + 9 种边 + 工具函数 |
| **analyzer** | 解析引擎 | 80% | 8 个 Parser + 3 个 Resolver + GraphBuilder + Storage |
| **server** | REST API + WebSocket | 75% | 9 个 API 路由 + WebSocket 广播，缺写入 API |
| **ui** | React 可视化前端 | 85% | Tab 系统 + 筛选 + i18n + Tooltip，3 个面板占位 |
| **mcp** | AI 助手接口 | 50% | 3 个工具，缺过滤参数和错误处理 |
| **cli** | 命令行工具 | 80% | 5 个命令（init/serve/analyze/check/mcp） |
| **demo** | 演示项目 | 30% | 基础骨架，未做端到端验证 |

---

## 三、analyzer 包详情

### 3.1 Parser（8 个）

| Parser | 解析目标 | 技术 | 状态 |
|--------|---------|------|------|
| PrismaParser | `.prisma` schema | @prisma/internals DMMF | ✅ |
| NextjsAppParser | App Router page/route | 文件路径 + 正则 | ✅ |
| NextjsPagesParser | Pages Router | 路径 + req.method 匹配 | ✅ |
| TrpcParser | tRPC router | ts-morph AST | ✅ |
| ExpressParser | Express 路由 | ts-morph AST | ✅ |
| TypeormParser | TypeORM Entity | ts-morph 装饰器识别 | ✅ |
| ApiCallsParser | 前端 API 调用 | ts-morph fetch/axios/trpc | ✅ |
| ReactComponentParser | React 组件 | ts-morph JSX 分析 | ✅ |

### 3.2 Resolver（3 个）

| Resolver | 功能 | 状态 |
|----------|------|------|
| PathAliasResolver | tsconfig 路径别名解析 | ✅ |
| SymbolResolver | 跨文件符号追踪（handler → DB） | ✅ |
| CrossLayerLinker | 跨层连线（前端 → 后端 → DB） | ⚠️ 部分完成 |

### 3.3 Graph 模块

| 模块 | 功能 | 状态 |
|------|------|------|
| GraphBuilder | 合并 Parser 输出，去重，验证，写入 DB | ✅ |
| ConsistencyChecker | 5 项一致性检查 | ✅ |

### 3.4 Storage 模块

| 模块 | 功能 | 状态 |
|------|------|------|
| Schema | 4 张表（nodes/edges/parse_errors/project_meta） | ✅ |
| OmniDatabase | sql.js 封装，完整 CRUD | ✅ |

---

## 四、UI 包详情

### 4.1 组件清单

| 组件 | 功能 | 状态 |
|------|------|------|
| App | 根组件，全局状态管理 | ✅ |
| Header | 品牌 + 搜索 + 语言切换 + 刷新 | ✅ |
| LangToggle | 中英文切换 | ✅ |
| Sidebar | 左侧节点列表（按类型分组） | ✅ |
| GraphCanvas | Cytoscape.js 图容器 | ✅ |
| NodeTooltip | 节点悬停浮层（600ms 延迟） | ✅ |
| NodeDetailPanel | 右侧详情面板 | ✅ |
| TabBar | Tab 栏（5 个标签页） | ✅ |
| TabPanel | Tab 面板容器（absolute 覆盖） | ✅ |
| FilterPanel | 筛选面板（节点/边/置信度/孤立） | ✅ |
| FilterChip | 筛选 chip 组件 | ✅ |
| **StatsPanel** | 统计面板 | **占位** |
| **AiPanel** | AI 功能面板 | **占位** |
| **IssuesPanel** | 问题检测面板 | **占位** |

### 4.2 Hooks

| Hook | 功能 | 状态 |
|------|------|------|
| useGraph | React Query 获取图数据 | ✅ |
| useGraphFilter | 图筛选 + 视口保护 | ✅ |
| useSearch | 搜索过滤 | ✅ |
| useCytoscape | Cytoscape 实例管理 | ⚠️ 死代码，未被使用 |

### 4.3 工具/配置

| 文件 | 功能 |
|------|------|
| graphTransform.ts | OmniGraph → Cytoscape 元素转换 |
| cytoscapeConfig.ts | 节点 emoji + 边样式配置 |
| nodeConfig.ts | 9 种节点 emoji + 颜色映射 |
| edgeConfig.ts | 9 种边类型列表 |
| i18n.ts | i18next 初始化 |
| cytoscapeContext.ts | 全局 Cytoscape Context |
| zh-CN.json / en-US.json | 57 个翻译词条 |

---

## 五、server / mcp / cli 包详情

### 5.1 server 包

**API 路由（9 个）：**

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/graph | 完整图数据 + 统计 |
| GET | /api/graph/nodes | 节点列表（支持 ?type= 过滤） |
| GET | /api/graph/nodes/:id | 单个节点 |
| GET | /api/graph/nodes/:id/edges | 节点的入边和出边 |
| GET | /api/graph/edges | 边列表（支持 ?type= 过滤） |
| GET | /api/graph/stats | 图统计 |
| GET | /api/graph/errors | 解析错误 |
| DELETE | /api/graph | 清空图数据 |
| GET | /api/health | 健康检查 |

**WebSocket：** 路径 /ws，支持服务端广播 `graph_updated` 事件。

### 5.2 mcp 包

| 工具 | 参数 | 功能 |
|------|------|------|
| getApiRoutes | 无 | 获取所有 API 路由 + tRPC procedure |
| getComponentTree | 无 | 组件列表 + renders 边构建的树 |
| findCallers | targetId | 查找节点的所有调用者（入边） |

### 5.3 cli 包

| 命令 | 功能 |
|------|------|
| codeomnivis init | 生成 .codeomnivis.json 配置 |
| codeomnivis serve | 启动 Web 服务器 + 自动分析 |
| codeomnivis analyze | 输出 JSON 图数据文件 |
| codeomnivis check | 运行一致性检查 |
| codeomnivis mcp | 启动 MCP Server |

---

## 六、计划 vs 实际对比

### 6.1 development-plan.md（7 个 Phase）

| Phase | 内容 | 计划标注 | 实际完成度 | 差距 |
|-------|------|---------|-----------|------|
| 1 | 骨架 + Prisma ER 图 | ✅ 已完成 | 95% | 存储层用 sql.js 非 better-sqlite3 |
| 2 | Next.js + tRPC 解析 | ✅ 已完成 | 85% | — |
| 3 | React 组件 + API 调用 | ✅ 已完成 | 75% | — |
| 4 | 跨层连线 | ✅ 已完成 | **60%** | symbolResolver 未完全集成，crossLayer 仅 1/4 |
| 5 | 可视化打磨 | ✅ 已完成 | **65%** | 无模块聚合、无命令面板、无 WebSocket 客户端 |
| 6 | MCP + CLI + 一致性检测 | ✅ 已完成 | 75% | MCP 工具偏少 |
| 7 | Demo + 发布 | ✅ 已完成 | **50%** | 无 cal.com 验证、无 GIF/截图 |

### 6.2 codeomnivis-plan-3.md（前端重设计）

| 计划项 | 状态 | 说明 |
|--------|------|------|
| 双行 Header + Tab 栏 | ✅ | 完全按计划实现 |
| 筛选器重构（FilterPanel） | ✅ | 替代 NodeTypeFilter |
| 视口保护 | ✅ | savedViewport ref 逻辑完整 |
| 节点 Tooltip + Emoji | ✅ | 600ms 延迟 + emoji + 颜色 |
| i18n 国际化 | ✅ | zh-CN / en-US + LangToggle |
| 刷新按钮修复 | ✅ | /api/analyze + React Query refetch |
| Tab 系统 | ✅ | 5 个 Tab，3 个占位 |
| 删除 useCytoscape.ts | ❌ | 文件仍存在（死代码） |

---

## 七、技术债务清单

### 7.1 高优先级

| 债务 | 位置 | 影响 |
|------|------|------|
| CrossLayerLinker 仅实现 linkCallsApi | analyzer/resolver/crossLayer.ts | 缺少 handles/calls_service/queries_db 三种跨层边 |
| symbolResolver 未集成到 CLI 流水线 | cli/commands/serve.ts | handler → service → DB 调用链无法自动追踪 |
| 三个 Tab 面板仅占位 | ui/components/TabBar/ | Issues/AI/Stats 无实际功能 |

### 7.2 中优先级

| 债务 | 位置 | 影响 |
|------|------|------|
| 5 个 Parser 各自独立 ts-morph Project | analyzer/parsers/*.ts | 跨 Parser 类型解析不一致，重复内存开销 |
| PrismaParser 大量 any 类型 | analyzer/parsers/prisma.ts | 丧失类型安全 |
| ExpressParser router 前缀覆盖 | analyzer/parsers/express.ts | 多 router 文件前缀互相覆盖 |
| CrossLayerLinker 修改传入 graph 对象 | analyzer/resolver/crossLayer.ts | 副作用操作，调用者不期望 |
| scanFileForDbCalls 正则覆盖不全 | analyzer/resolver/crossLayer.ts | 降级路径不匹配 TypeORM EntityManager 模式 |
| sql.js 外键约束未启用 | analyzer/storage/schema.ts | FOREIGN KEY 形同虚设 |
| 无增量解析 | analyzer 全局 | 每次全量扫描，大项目性能差 |
| scanDirectory 重复实现 | cli/commands/*.ts | serve/analyze/check 三处重复代码 |
| autoDetect 逻辑不完整 | cli/utils/autoDetect.ts | trpcRouterPaths/typeormEntityDirs 始终为空 |
| 无 WebSocket 客户端 | ui | 服务端有广播，客户端无接收 |

### 7.3 低优先级

| 债务 | 位置 | 影响 |
|------|------|------|
| useCytoscape.ts 死代码 | ui/hooks/ | 文件存在但未被引用 |
| NextjsPagesParser req.method 匹配粗糙 | analyzer/parsers/nextjsPages.ts | 不覆盖双引号和 switch 模式 |
| SymbolResolver traceCache 无界 | analyzer/resolver/symbolResolver.ts | 长时间运行内存泄漏 |
| ConsistencyReport 接口不一致 | checker 用 stats，shared 用 summary | 类型对齐问题 |
| NODE_COLORS 重复定义 | shared + ui/lib/nodeConfig.ts | 两处颜色映射 |

---

## 八、下一步建议

### 8.1 短期（1-2 天）

1. **删除 useCytoscape.ts** — 死代码清理
2. **实现 IssuesPanel** — 复用 ConsistencyChecker，连接 /api/graph/errors
3. **实现 StatsPanel** — 连接 /api/graph/stats，显示节点/边/孤立/连通率
4. **修复 scanDirectory 重复** — 抽取为 cli 公共模块

### 8.2 中期（3-5 天）

5. **完成 CrossLayerLinker** — 实现 linkHandles / linkCallsService / linkQueriesDb
6. **集成 symbolResolver 到 CLI 流水线** — serve/analyze 命令中启用符号追踪
7. **修复 PrismaParser any 类型** — 导入 DMMF 类型
8. **修复 sql.js 外键约束** — 添加 PRAGMA foreign_keys = ON

### 8.3 长期（1-2 周）

9. **模块聚合** — 大图节点折叠/展开
10. **命令面板** — Cmd+K 弹窗搜索
11. **WebSocket 客户端** — 实时图更新
12. **cal.com 端到端验证** — 大项目兼容性测试
13. **Demo + README GIF** — 发布准备

---

## 九、测试覆盖

| 包 | 测试文件数 | 用例数 | 覆盖范围 |
|----|-----------|--------|---------|
| analyzer | 9 | 80 | Parser（5）+ Resolver（3）+ Storage（1） |
| shared | 0 | 0 | 无测试 |
| server | 0 | 0 | 无测试 |
| ui | 0 | 0 | 无测试 |
| mcp | 0 | 0 | 无测试 |
| cli | 0 | 0 | 无测试 |

**测试集中在 analyzer 包，其余包无测试覆盖。**

---

## 十、文件统计

```
packages/
├── shared/        8 源文件
├── analyzer/      18 源文件 + 9 测试文件 + 8 fixtures
├── server/        3 源文件
├── ui/            25 源文件 + 2 locale 文件
├── mcp/           1 源文件
├── cli/           7 源文件
└── demo/          待确认
```

**总计：~62 源文件 + 9 测试文件**
