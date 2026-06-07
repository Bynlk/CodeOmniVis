# CodeOmniVis 验证报告 + 计划书

> 生成日期：2026-06-06
> 验证方式：全量代码扫描 + 逐项代码行号确认

---

## 一、原报告验证结果

### 1.1 development-plan.md 各 Phase 置信度

| Phase | 原报告完成度 | 验证后完成度 | 置信度 | 修正说明 |
|-------|-------------|-------------|--------|---------|
| 1 | 95% | 95% | 🟢 高 | 无修正 |
| 2 | 85% | 85% | 🟢 高 | 无修正 |
| 3 | 75% | 75% | 🟢 高 | 无修正 |
| 4 | 60% | **85%** | 🟢 高 | **原报告低估**：CrossLayerLinker 4/4 方法全部实现，symbolResolver 已通过 CrossLayerLinker 间接集成 CLI |
| 5 | 65% | 65% | 🟢 高 | 无修正 |
| 6 | 75% | 75% | 🟢 高 | 无修正 |
| 7 | 50% | 50% | 🟢 高 | 无修正 |
| **综合** | **70%** | **~76%** | 🟢 高 | Phase 4 严重低估 |

### 1.2 技术债务验证（原报告 17 项）

| # | 债务 | 原报告状态 | 验证结果 | 置信度 |
|---|------|-----------|---------|--------|
| 1 | 5 Parser 独立 ts-morph Project | ✅ | ✅ 确认（5 文件，各自 new Project()） | 🟢 高 |
| 2 | PrismaParser any 类型 | ✅ | ✅ 确认（7 处，第 126/132/133/161/176/204 行） | 🟢 高 |
| 3 | ExpressParser router 前缀覆盖 | ✅ | ⚠️ 部分存在（多 Router 场景，第 161-186 行） | 🟡 中 |
| 4 | CrossLayerLinker 修改 graph 对象 | ✅ | ✅ 确认（5 处 push，第 350/373/387/437/478 行） | 🟢 高 |
| 5 | scanFileForDbCalls 正则不全 | ✅ | ⚠️ 部分存在（仅 Prisma，缺 TypeORM，第 520-544 行） | 🟡 中 |
| 6 | sql.js 外键未启用 | ✅ | ✅ 确认（缺 PRAGMA foreign_keys = ON，第 14-15 行） | 🟢 高 |
| 7 | symbolResolver 未集成 CLI | ✅ | **❌ 已修复**（serve.ts 第 120 行通过 CrossLayerLinker 集成） | 🟢 高 |
| 8 | CrossLayerLinker 仅 1/4 | ✅ | **❌ 已修复**（link() 完整调用 4 个子方法，第 85/89/93/97 行） | 🟢 高 |
| 9 | useCytoscape.ts 死代码 | ✅ | ✅ 确认（无任何 import） | 🟢 高 |
| 10 | 三个 Tab 面板占位 | ✅ | ✅ 确认（纯文本 "coming soon"） | 🟢 高 |
| 11 | NODE_COLORS 重复 | ✅ | ✅ 确认（3 处颜色值不一致） | 🟢 高 |
| 12 | Server 无写入 API | ✅ | ✅ 确认（无 POST/PUT/PATCH） | 🟢 高 |
| 13 | WebSocket 仅服务端推送 | ✅ | ✅ 确认（无 ws.on('message')） | 🟢 高 |
| 14 | MCP 仅 3 工具 | ✅ | ✅ 确认 | 🟢 高 |
| 15 | MCP as any 断言 | ✅ | ✅ 确认（4 处） | 🟢 高 |
| 16 | scanDirectory 重复 | ✅ | ✅ 确认（3 份副本） | 🟢 高 |
| 17 | autoDetect 不完整 | ✅ | ✅ 确认（2 个硬编码空数组） | 🟢 高 |

**验证结论：原报告 17 项中，15 项确认存在，2 项已修复（被原报告误判）。**

---

## 二、深度扫描新发现（原报告未覆盖）

### 2.1 类型安全（90+ 处 as any）— 🟡 中严重度

| 位置 | 数量 | 置信度 | 说明 |
|------|------|--------|------|
| cytoscapeConfig.ts | 14 处 | 🟢 高 | 返回类型 any[]，所有 style 对象 as any |
| analyzer parsers（6 个文件） | 30+ 处 | 🟢 高 | forEachDescendant 回调参数 (node: any) |
| crossLayer.ts + consistency.ts | 20 处 | 🟢 高 | metadata 访问全部 as any |
| mcp/index.ts | 4 处 | 🟢 高 | getNodesByType 参数 as any |
| db.ts + sql.js.d.ts | 6 处 | 🟢 高 | 行转换函数 any |

### 2.2 错误处理缺失 — 🔴 高严重度

| 问题 | 位置 | 置信度 | 影响 |
|------|------|--------|------|
| 空 catch 块（ROLLBACK 静默失败） | db.ts 第 150/321/507 行 | 🟢 高 | 数据库可能不一致 |
| JSON.parse 无 try-catch | db.ts 第 683/698/712/726 行 | 🟢 高 | 损坏 JSON 导致整个查询失败 |
| MCP 工具无 try-catch | mcp/index.ts 第 82-183 行 | 🟢 高 | 异常可能导致 MCP 连接断开 |
| fetch 状态码未检查 | Header.tsx 第 29-38 行 | 🟢 高 | 4xx/5xx 被静默忽略 |
| db.ts 初始化竞态 | db.ts 第 41-43 行 | 🟡 中 | ensureReady() 不等待 initPromise |

### 2.3 性能问题 — 🟡 中严重度

| 问题 | 位置 | 置信度 | 影响 |
|------|------|--------|------|
| O(n*m) 节点查找 | consistency.ts 第 155/205 行 | 🟢 高 | 大图性能差 |
| O(n) 节点查找（循环内） | crossLayer.ts 第 130/139/329/359/386/400/478/500 行 | 🟢 高 | 同上 |
| GraphCanvas useEffect 依赖 | GraphCanvas.tsx 第 130 行 | 🟡 中 | onNodeSelect 变化会重建整个 cy 实例 |

### 2.4 安全问题 — 🟢 低严重度（开发工具，非生产服务）

| 问题 | 位置 | 置信度 |
|------|------|--------|
| CORS 默认 * | server/index.ts 第 52 行 | 🟢 高 |
| 无输入验证 | server/routes/graph.ts 第 54/84/147 行 | 🟢 高 |
| DELETE 无认证 | server/routes/graph.ts 第 194 行 | 🟢 高 |

### 2.5 依赖/配置问题 — 🟢 低严重度

| 问题 | 位置 | 置信度 |
|------|------|--------|
| server/cli 缺 @types/node | package.json | 🟡 中（可能间接获得） |
| mcp package.json main/types 不一致 | mcp/package.json 第 7-8 行 | 🟢 高 |
| mcp tsconfig 不必要 DOM lib | mcp/tsconfig.json 第 6 行 | 🟢 高 |
| demo tsconfig 未继承 base | demo/tsconfig.json | 🟢 高 |

---

## 三、问题全景（置信度排序）

### 🔴 高优先级（影响功能/数据正确性，置信度高）

| # | 问题 | 包 | 严重度 | 置信度 | 工作量 |
|---|------|-----|--------|--------|--------|
| 1 | 三个 Tab 面板仅占位 | ui | 高 | 🟢 高 | 4h |
| 2 | NODE_COLORS 重复且不一致 | shared+ui | 高 | 🟢 高 | 0.5h |
| 3 | db.ts 空 catch 块（ROLLBACK 静默） | analyzer | 高 | 🟢 高 | 0.5h |
| 4 | JSON.parse 无 try-catch | analyzer | 高 | 🟢 高 | 1h |
| 5 | MCP 工具无错误处理 | mcp | 高 | 🟢 高 | 1h |
| 6 | fetch 状态码未检查 | ui | 中 | 🟢 高 | 0.5h |

### 🟡 中优先级（代码质量/性能，置信度高）

| # | 问题 | 包 | 严重度 | 置信度 | 工作量 |
|---|------|-----|--------|--------|--------|
| 7 | O(n*m) 节点查找 | analyzer | 中 | 🟢 高 | 1h |
| 8 | scanDirectory 重复实现 | cli | 中 | 🟢 高 | 0.5h |
| 9 | useCytoscape.ts 死代码 | ui | 低 | 🟢 高 | 0.1h |
| 10 | autoDetect trpcRouterPaths/typeormEntityDirs 空 | cli | 中 | 🟢 高 | 2h |
| 11 | scanFileForDbCalls 缺 TypeORM | analyzer | 中 | 🟡 中 | 1h |
| 12 | ExpressParser 多 Router 前缀覆盖 | analyzer | 中 | 🟡 中 | 1.5h |
| 13 | PrismaParser 7 处 any | analyzer | 中 | 🟢 高 | 1h |
| 14 | 5 Parser 独立 ts-morph Project | analyzer | 中 | 🟢 高 | 3h |
| 15 | CrossLayerLinker 副作用修改 graph | analyzer | 中 | 🟢 高 | 2h |
| 16 | sql.js 外键未启用 | analyzer | 低 | 🟢 高 | 0.1h |
| 17 | GraphCanvas useEffect 依赖问题 | ui | 中 | 🟡 中 | 1h |

### 🟢 低优先级（安全/配置，开发工具影响小）

| # | 问题 | 包 | 严重度 | 置信度 | 工作量 |
|---|------|-----|--------|--------|--------|
| 18 | CORS * + 无输入验证 + DELETE 无认证 | server | 低 | 🟢 高 | 2h |
| 19 | mcp package.json main/types 不一致 | mcp | 低 | 🟢 高 | 0.1h |
| 20 | mcp tsconfig 不必要 DOM lib | mcp | 低 | 🟢 高 | 0.1h |
| 21 | server/cli 缺 @types/node | server/cli | 低 | 🟡 中 | 0.1h |
| 22 | demo tsconfig 未继承 base | demo | 低 | 🟢 高 | 0.1h |
| 23 | 90+ 处 as any（全局） | 全局 | 中 | 🟢 高 | 8h+ |

---

## 四、计划书

### Phase A：快速修复（1 天）

> 目标：修复高置信度、低工作量的问题

| 任务 | 工作量 | 文件 |
|------|--------|------|
| A1. 删除 useCytoscape.ts | 5min | ui/hooks/useCytoscape.ts |
| A2. 统一 NODE_COLORS（UI 改为引用 shared） | 30min | ui/lib/nodeConfig.ts |
| A3. db.ts 空 catch 块加 console.error | 30min | analyzer/storage/db.ts |
| A4. db.ts JSON.parse 加 try-catch | 1h | analyzer/storage/db.ts |
| A5. sql.js 启用 PRAGMA foreign_keys | 5min | analyzer/storage/schema.ts |
| A6. Header.tsx fetch 检查响应状态 | 30min | ui/components/Header.tsx |
| A7. mcp package.json 修正 main/types | 5min | mcp/package.json |
| A8. mcp tsconfig 移除 DOM lib | 5min | mcp/tsconfig.json |

**预计：3 小时**

### Phase B：功能补全（1-2 天）

> 目标：补全占位面板，让 Tab 系统真正可用

| 任务 | 工作量 | 文件 |
|------|--------|------|
| B1. 实现 StatsPanel | 2h | ui/components/TabBar/StatsPanel.tsx |
| B2. 实现 IssuesPanel | 2h | ui/components/TabBar/IssuesPanel.tsx |
| B3. MCP 工具加 try-catch 错误处理 | 1h | mcp/index.ts |
| B4. cli scanDirectory 抽取为公共模块 | 30min | cli/utils/scanDirectory.ts |
| B5. autoDetect 补全 trpcRouterPaths/typeormEntityDirs | 2h | cli/utils/autoDetect.ts |

**预计：7.5 小时**

### Phase C：性能 + 质量（2-3 天）

> 目标：解决性能瓶颈和代码质量问题

| 任务 | 工作量 | 文件 |
|------|--------|------|
| C1. consistency.ts 预构建 Map 索引 | 1h | analyzer/graph/consistency.ts |
| C2. crossLayer.ts 预构建 Map 索引 | 1h | analyzer/resolver/crossLayer.ts |
| C3. scanFileForDbCalls 补充 TypeORM 模式 | 1h | analyzer/resolver/crossLayer.ts |
| C4. ExpressParser 多 Router 前缀修复 | 1.5h | analyzer/parsers/express.ts |
| C5. PrismaParser 导入 DMMF 类型 | 1h | analyzer/parsers/prisma.ts |
| C6. CrossLayerLinker 返回新对象而非修改原对象 | 2h | analyzer/resolver/crossLayer.ts |
| C7. GraphCanvas useEffect 依赖优化 | 1h | ui/components/GraphCanvas.tsx |
| C8. MCP getNodesByType/getEdgesByType 类型修正 | 0.5h | analyzer/storage/db.ts |

**预计：9 小时**

### Phase D：安全加固（1 天，可选）

> 目标：开发工具安全性基础加固

| 任务 | 工作量 | 文件 |
|------|--------|------|
| D1. CORS 限制为 localhost | 30min | server/index.ts |
| D2. 输入验证 NodeType/EdgeType | 1h | server/routes/graph.ts |
| D3. DELETE /api/graph 加确认 header | 30min | server/routes/graph.ts |
| D4. server/cli 补 @types/node | 5min | package.json |

**预计：2 小时**

### Phase E：架构优化（长期，可选）

> 目标：解决深层架构问题

| 任务 | 工作量 | 说明 |
|------|--------|------|
| E1. 共享 ts-morph Project 实例 | 3h | 5 个 Parser 共享一个 Project |
| E2. 消除 90+ 处 as any | 8h+ | 分批进行，先 metadata 类型，再 parser |
| E3. AiPanel 实现 | 4h+ | 依赖 MCP 修复完成 |

**预计：15+ 小时**

---

## 五、执行优先级

```
Phase A (3h)  ──→  Phase B (7.5h)  ──→  Phase C (9h)  ──→  Phase D (2h)  ──→  Phase E (15h+)
  快速修复            功能补全             性能质量           安全加固            架构优化
  置信度🟢高          置信度🟢高           置信度🟢高         置信度🟢高          置信度🟡中
```

**建议从 Phase A 开始，3 小时内可完成 8 项高置信度修复。**

---

## 六、置信度统计

| 置信度 | 数量 | 占比 |
|--------|------|------|
| 🟢 高（代码行号确认） | 19 项 | 83% |
| 🟡 中（部分确认/需更多上下文） | 4 项 | 17% |
| 🔴 低（推测/未确认） | 0 项 | 0% |

**总体置信度：🟢 高（83% 问题有精确代码行号支撑）**
