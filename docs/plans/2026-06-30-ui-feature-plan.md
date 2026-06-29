# CodeOmniVis 前端能力增强方案计划书

> 状态：已审定（用户 6 轮 Q&A 锁定全部决策）
> 仓库：`/Users/new/CodeOmniVis`（canonical git 工作树，master）
> 执行编排：本方案为 **Stage B**，前置依赖 **Stage A 类型安全方案**（见 `docs/superpowers/plans/2026-06-30-type-driven-design.md`）。统一 loop 治理见 `docs/superpowers/LOOP_ENGINEERING.md`。

## 1. 目标

让 CodeOmniVis 从「能分析」升级为「新手装上即用、能追踪、能配置、能自我说明」的工具，覆盖六项已锁定能力（#15–#20）。

## 2. 已锁定决策

| 维度 | 决策 |
| --- | --- |
| 配置存储 | 前端 localStorage 存 AI baseUrl/apiKey/model；不落库 |
| 启动方式 | 先「能装能跑」（npm/pnpm 安装 + 命令启动 + 启动后选目录），后「公开可装」 |
| 数据新鲜度 | 方案一确定：状态可视化 + 智能监听 + 手动兜底；二期再做真增量(hash skip / dirty re-run) |
| 全链路追踪 | 独立 tab；分层泳道布局；循迹光点 B+F（双向追溯+分叉全亮，2 为默认、3 为单步行为）；节点卡片标题用「第 N 站」，正文三栏；悬浮窗常驻、光点循环、每站停顿 1s |
| 节点说明 | 基于项目内容自动说明节点作用（静态优先，AI 兜底，与 explain 同策略） |
| 设置入口 | 顶栏齿轮 → 右侧抽屉，四组：AI / 项目 / 显示 / 关于 |
| 推广 | 三层推广位；非商业 License（PolyForm Noncommercial，措辞需规避商用引导） |
| 样式 | 继续沿用 TailwindCSS（用户第 7 轮明确确认） |

## 3. 任务清单（与 loop TASKS 对应）

### #15 AI 请求契约修复 + 前端配置
- 修复 `AiPanel.tsx`：请求体 `{message,context}` → `{messages:ChatMessage[],config?}`；读取 `data.data.content`（非 `data.response`）。
- 前端 localStorage 配置面板，请求体优先级：body.config > 环境变量 > 501。
- **基线修正**：git 仓库已把 AI 路由合并进 `packages/server/src/index.ts`，**无独立 `routes/ai.ts`**。落点改为 `index.ts` 中的 `/api/ai/chat`、`/api/ai/explain` handler。

### #16 打包自包含 + 全局安装
- `pnpm deploy` 本地自包含；tsup `--noExternal` 打包 CLI 依赖；UI dist 内联进 CLI；sql.js wasm 随包。
- `uiDistPath` 相对路径打包断点修复；`workspace:*` 发布断点处理。

### #17 数据新鲜度（方案一）
- 一期：分析状态可视化（fresh/analyzing/stale）+ 智能监听（替代硬编码 DEFAULT_WATCH_DIRS）+ 手动刷新兜底；修复 isAnalyzing 丢变更 bug。
- 二期：真增量 + 文件 hash skip + dirty 子图 re-run。

### #18 全链路追踪 Tab
- `DataFlowTracer` 扩展 `traceFromNode`（双向：上游+下游，突破「只从 db_model 起」限制）。
- 新增 `GET /api/graph/trace`（git 仓库路由在 `routes/graph.ts`）。
- UI：`TracePanel` / `TraceRunner` / `TraceStepCard`；分层泳道；循迹光点动画（默认全亮 + 单步聚焦，每站停顿 1s，循环）。
- 节点自动说明：静态(JSDoc/类型)优先，AI 兜底。

### #19 图谱噪声治理 + 界面内选目录
- 自引用边/重叠端点（Cytoscape invalid-endpoints）治理。
- 新增 `POST /api/project` 运行时切换项目根目录。

### #20 设置抽屉 + 推广位
- 顶栏齿轮按钮 → 右侧抽屉，四组（AI/项目/显示/关于）。
- 三层推广位；非商业 License 合规措辞。

## 4. 风险

- 类型地基（Stage A）未冻结前做 #18 会反复返工 → 必须串行，A 先行。
- 打包自包含涉及 sql.js wasm 与相对路径，是回归高发区。
- 运行时切目录需保证 watcher / DB 正确重建。
