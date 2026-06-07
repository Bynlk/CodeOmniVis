# CodeOmniVis 开发计划书 v2.0

> 基于 2026-06-06 全量代码验证
> 置信度：🟢 高（83% 问题有精确代码行号支撑）

---

## 一、项目现状

| 维度 | 数值 |
|------|------|
| 综合完成度 | **76%**（修正后） |
| 源文件数 | ~62 个 |
| 测试用例 | 80 个（全部通过） |
| 技术债务 | 23 项（19 高置信 + 4 中置信） |
| as any 使用 | 90+ 处 |

### 各包完成度

| 包 | 完成度 | 核心差距 |
|----|--------|---------|
| shared | 95% | 无 |
| analyzer | 80% | O(n*m) 查找、正则覆盖不全、any 类型 |
| server | 75% | 无写入 API、无输入验证 |
| ui | 85% | 3 个 Tab 面板占位、颜色不一致 |
| mcp | 50% | 仅 3 工具、无错误处理 |
| cli | 80% | scanDirectory 重复、autoDetect 不完整 |
| demo | 30% | 未做端到端验证 |

---

## 二、Phase A — 快速修复（1 天）

> 目标：修复高置信度、低工作量的问题，消除明显隐患

### 任务清单

| ID | 任务 | 文件 | 工作量 | 验收标准 |
|----|------|------|--------|---------|
| A1 | 删除 useCytoscape.ts | `ui/hooks/useCytoscape.ts` | 5min | 文件不存在，构建通过 |
| A2 | 统一 NODE_COLORS（UI 引用 shared） | `ui/lib/nodeConfig.ts` | 30min | 删除 UI 独立定义，改为 import shared |
| A3 | db.ts 空 catch 块加 console.error | `analyzer/storage/db.ts` 第 150/321/507 行 | 30min | ROLLBACK 失败有日志输出 |
| A4 | db.ts JSON.parse 加 try-catch | `analyzer/storage/db.ts` 第 683/698/712/726 行 | 1h | 损坏 JSON 跳过单条记录，不中断批量查询 |
| A5 | sql.js 启用 PRAGMA foreign_keys | `analyzer/storage/schema.ts` 第 14 行 | 5min | 添加 `PRAGMA foreign_keys = ON;` |
| A6 | Header.tsx fetch 检查响应状态 | `ui/components/Header.tsx` 第 29-38 行 | 30min | 非 2xx 响应显示错误提示 |
| A7 | mcp package.json 修正 main/types | `mcp/package.json` 第 7-8 行 | 5min | 改为 .mjs/.d.mts 与其他包一致 |
| A8 | mcp tsconfig 移除 DOM lib | `mcp/tsconfig.json` 第 6 行 | 5min | lib 仅保留 ES2022 |

**预计工时：3 小时**
**风险：低（全部是局部修改，不影响核心逻辑）**

### 执行顺序

```
A1 → A2 → A5 → A7 → A8（独立，可并行）
A3 → A4（依赖关系，先 A3 后 A4）
A6（独立）
```

---

## 三、Phase B — 功能补全（2 天）

> 目标：补全占位面板，让 Tab 系统真正可用

### 任务清单

| ID | 任务 | 文件 | 工作量 | 验收标准 |
|----|------|------|--------|---------|
| B1 | 实现 StatsPanel | `ui/components/TabBar/StatsPanel.tsx` | 2h | 显示节点数/边数/孤立节点/连通率，调用 /api/graph/stats |
| B2 | 实现 IssuesPanel | `ui/components/TabBar/IssuesPanel.tsx` | 2h | 显示一致性检查结果，调用 /api/graph/errors，按严重度分组 |
| B3 | MCP 工具加 try-catch | `mcp/index.ts` 第 82-183 行 | 1h | 每个工具调用包裹 try-catch，返回错误信息而非断开连接 |
| B4 | scanDirectory 抽取公共模块 | `cli/utils/scanDirectory.ts` | 30min | 3 份副本合并为 1 份，serve/analyze/check 改为 import |
| B5 | autoDetect 补全路径检测 | `cli/utils/autoDetect.ts` | 2h | trpcRouterPaths 扫描 server/routers/，typeormEntityDirs 扫描 entity/ |

**预计工时：7.5 小时**
**风险：中（B1/B2 需要对接后端 API，B5 需要理解项目结构）**

### B1 StatsPanel 实现方案

```typescript
// 调用 /api/graph/stats
// 显示：节点总数、边总数、孤立节点数、连通率
// 按节点类型分组计数（饼图或列表）
// 使用 i18n 词条 stats.nodes / stats.edges / stats.isolated / stats.coverage
```

### B2 IssuesPanel 实现方案

```typescript
// 调用 /api/graph/errors（已有端点）
// 按 IssueType 分组：deadLink / unusedRoute / methodMismatch / isolated
// 每个 issue 显示：类型 emoji + 描述 + 文件位置
// 点击 issue 跳转到对应节点（调用 onNodeSelect）
// 使用 i18n 词条 issues.deadLink / issues.unusedRoute / issues.methodMismatch / issues.isolated
```

### 执行顺序

```
B4（独立，最先执行）
B3（独立）
B1 → B2（依赖 B3 完成后确认 API 行为）
B5（独立）
```

---

## 四、Phase C — 性能 + 质量（3 天）

> 目标：解决性能瓶颈和代码质量问题

### 任务清单

| ID | 任务 | 文件 | 工作量 | 验收标准 |
|----|------|------|--------|---------|
| C1 | consistency.ts 预构建 Map 索引 | `analyzer/graph/consistency.ts` | 1h | 查找从 O(n) 降为 O(1) |
| C2 | crossLayer.ts 预构建 Map 索引 | `analyzer/resolver/crossLayer.ts` | 1h | 同上 |
| C3 | scanFileForDbCalls 补充 TypeORM | `analyzer/resolver/crossLayer.ts` 第 520-544 行 | 1h | 添加 Repository + EntityManager 正则 |
| C4 | ExpressParser 多 Router 前缀修复 | `analyzer/parsers/express.ts` 第 161-186 行 | 1.5h | 每个 Router 独立前缀，不互相覆盖 |
| C5 | PrismaParser 导入 DMMF 类型 | `analyzer/parsers/prisma.ts` | 1h | 消除 7 处 any，使用 @prisma/internals 类型 |
| C6 | CrossLayerLinker 返回新对象 | `analyzer/resolver/crossLayer.ts` | 2h | link() 返回新 nodes/edges，不修改原 graph |
| C7 | GraphCanvas useEffect 优化 | `ui/components/GraphCanvas.tsx` | 1h | onNodeSelect 变化不重建 cy 实例 |
| C8 | MCP getNodesByType 类型修正 | `analyzer/storage/db.ts` | 0.5h | 参数类型接受 NodeType/EdgeType 字面量 |

**预计工时：9 小时**
**风险：中（C4/C6 涉及核心逻辑重构，需要充分测试）**

### C1/C2 实现方案

```typescript
// 在方法开头构建索引
const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
const edgeMap = new Map(graph.edges.map(e => [e.id, e]))

// 替换所有 graph.nodes.find(n => n.id === xxx)
// 为 nodeMap.get(xxx)
```

### C6 实现方案

```typescript
// link() 方法签名改为：
link(graph: OmniGraph): { nodes: OmniNode[], edges: OmniEdge[] }

// 内部操作副本而非原对象
const newNodes = [...graph.nodes]
const newEdges = [...graph.edges]
// ... push 到 newNodes/newEdges
return { nodes: newNodes, edges: newEdges }
```

### 执行顺序

```
C1 → C2（独立，可并行）
C3（独立）
C5（独立）
C8（独立）
C4（独立）
C6 → C7（C6 改接口后 C7 适配）
```

---

## 五、Phase D — 安全加固（1 天，可选）

> 目标：开发工具安全性基础加固

### 任务清单

| ID | 任务 | 文件 | 工作量 | 验收标准 |
|----|------|------|--------|---------|
| D1 | CORS 限制为 localhost | `server/index.ts` 第 52 行 | 30min | 默认 origin 改为 `http://localhost:${port}` |
| D2 | 输入验证 NodeType/EdgeType | `server/routes/graph.ts` | 1h | type 参数校验是否在 NODE_TYPE_LIST/EDGE_TYPE_LIST 中 |
| D3 | DELETE 加确认 header | `server/routes/graph.ts` 第 194 行 | 30min | 要求 `X-Confirm: true` header |
| D4 | server/cli 补 @types/node | `packages/server/package.json` `packages/cli/package.json` | 5min | devDependencies 添加 @types/node |

**预计工时：2 小时**
**风险：低**

---

## 六、Phase E — 架构优化（长期，可选）

> 目标：解决深层架构问题，提升代码质量

### 任务清单

| ID | 任务 | 工作量 | 说明 |
|----|------|--------|------|
| E1 | 共享 ts-morph Project 实例 | 3h | 5 个 Parser 共享一个 Project，减少内存开销 |
| E2 | 消除 metadata as any | 4h | 为每种 node/edge 类型定义 metadata 联合类型 |
| E3 | 消除 parser forEachDescendant any | 2h | 使用 ts-morph Node 类型 |
| E4 | 消除 cytoscapeConfig as any | 1h | 使用 Cytoscape.CSSStyleDeclaration |
| E5 | AiPanel 实现 | 4h+ | 依赖 MCP 修复完成，接入 Claude API |
| E6 | WebSocket 客户端实现 | 3h | UI 监听 graph_updated 事件自动刷新 |
| E7 | 命令面板（Cmd+K 弹窗） | 4h | 搜索结果下拉 + 键盘导航 |

**预计工时：21+ 小时**
**风险：高（E1/E2 涉及核心接口变更）**

---

## 七、里程碑

| 里程碑 | Phase | 预计完成 | 交付物 |
|--------|-------|---------|--------|
| **M1 — 稳定基线** | A | 1 天 | 8 项修复，无明显隐患 |
| **M2 — 功能完整** | A+B | 3 天 | Tab 系统全部可用，MCP 健壮 |
| **M3 — 性能达标** | A+B+C | 6 天 | 大图性能优化，代码质量提升 |
| **M4 — 生产就绪** | A+B+C+D | 7 天 | 安全加固完成 |
| **M5 — 架构优秀** | A+B+C+D+E | 14+ 天 | 消除所有 as any，架构优化 |

---

## 八、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Phase C 重构引入回归 | 中 | 高 | 每个任务完成后运行全量测试 |
| B1/B2 后端 API 不满足需求 | 低 | 中 | 先检查现有 API 返回格式 |
| E1 共享 ts-morph 引发解析错误 | 中 | 高 | 逐步迁移，保留旧实现作为 fallback |
| E2 metadata 类型工作量超预期 | 高 | 中 | 分批进行，先处理高频类型 |

---

## 九、测试策略

| Phase | 测试要求 |
|-------|---------|
| A | 全量构建 + 80 个现有测试通过 |
| B | 新增 StatsPanel/IssuesPanel 截图验证 |
| C | 新增 consistency/crossLayer 性能测试 |
| D | 手动测试 CORS 和输入验证 |
| E | 新增类型安全测试（无 as any） |

---

## 十、文件变更预估

| Phase | 新增文件 | 修改文件 | 删除文件 |
|-------|---------|---------|---------|
| A | 0 | 7 | 1 |
| B | 1 | 5 | 0 |
| C | 0 | 6 | 0 |
| D | 0 | 3 | 0 |
| E | 0 | 10+ | 0 |
| **合计** | **1** | **31+** | **1** |

---

*计划书版本：2.0 | 基于 2026-06-06 全量代码验证*
