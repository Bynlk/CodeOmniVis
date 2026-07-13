# CHANGELOG

All notable changes to CodeOmniVis. Format loosely follows Keep a Changelog.

## [Unreleased] — 2026-06-30

### Stage B · 前端能力套件 (#15–#20)

#### Added
- **AI 对话契约** (`@codeomnivis/shared` `types/ai.ts`): `ChatMessage` / `AiConfig` / `AiChatRequest` / `AiChatResponse` 及守卫 `isChatMessage` / `isAiConfig` / `parseAiChatRequest`,纯函数 `resolveAiConfig`(优先级 body.config > env > null)。
- **AI 路由** (`server`): `POST /api/ai/chat` 与 `/api/ai/explain`,上游为用户自配置的 OpenAI 兼容 `/chat/completions`(不经任何内部网关);凭据优先级 body.config > 环境变量 > 501。
- **前端 AI 配置**: `lib/aiConfig.ts`(`codeomnivis.ai.config` localStorage,`parseAiConfig` 守卫);AiPanel 配置面板。
- **自包含打包** (`@bynlk/codeomnivis`): tsup 内联全部 workspace 包,UI dist 与 kotlin wasm 随包发布,全局安装即可运行。
- **数据新鲜度** (`shared` `types/freshness.ts`): `FreshnessStatus` (fresh/analyzing/stale) + 守卫;Header `FreshnessBadge` 状态徽章;`GET /api/status`;WS `status_changed` 广播;`useStatus` hook。
- **智能文件监听**: `incremental.ts` 在未指定 watchDirs 时监听整个 projectRoot(按 IGNORED_PATHS + 源码后缀过滤);序列化重分析,分析中到达的变更触发一次补充重跑(原先被静默丢弃)。
- **全链路追踪 tab**: `shared` `types/trace.ts` 契约;analyzer `DataFlowTracer.traceFromNode` 双向遍历(上下游,max 64,访问集防环);`GET /api/graph/trace?node=<id>`;UI trace tab + `SelectionContext` + `useTrace`;`TraceStepCard` / `TraceRunner`(cytoscape 循迹光点,1s/站)/ `TracePanel`(静态优先 + AI 兜底解释)。
- **图谱噪声治理**: 纯函数 `sanitizeGraph`(去自环边 / 悬挂端点边 / 重复 (source,type,target) 边,返回统计),接入 `GET /api/graph` 响应 meta。
- **运行时切换项目目录**: `IncrementalAnalyzer.setProjectRoot` / `getProjectRoot`;`POST /api/project`(校验目录存在,清图重分析)。
- **设置抽屉** `SettingsDrawer`: AI / 项目 / 显示 / 关于 四组;Header 齿轮入口;`lib/promotion.ts` 三层推广位 + 非商业 License (PolyForm Noncommercial 1.0.0) 措辞。
- 18 个新 i18n key/locale(EN/ZH),共 155 key。

#### Changed
- AiPanel 读取 `data.data.content`(原 `data.response`);AiPanel/TracePanel 复用 `lib/aiConfig` 公共模块。
- `POST /api/analyze` 改为委托 `incrementalAnalyzer.refresh()`(共享序列化)。
- CLI `package.json`:第三方依赖移入 dependencies,workspace 包改 devDependencies(workspace:*),`main` 指向 `./dist/index.js`,build 使用 tsup。

#### Fixed
- AI 请求契约前后端不一致(响应字段、配置缺失时的 501)。
- 文件变更在分析进行中被静默丢弃 — 现保证最终一致(rerunRequested)。
- `turbo.json` 增加 `globalPassThroughEnv: ["TMPDIR"]`,使 turbo 下的 vitest 继承沙箱临时目录。

### Stage A · 类型驱动设计 (A0–A9) — 已合并 master
- NodeMetadata / EdgeMetadata 改为封闭判别联合,移除 `Record<string,unknown>` fallback。
- 删除 `metadataValue()`,改用 `getRouteDisplay` / `getNodeRoute` + `isNodeOfType` 收窄。
- parser/storage 经 `createTypedNode` / `createTypedEdge` 工厂与 switch 复活器,零 cast。
- 落地 type-aware ESLint(`no-unsafe-*` + `no-explicit-any` 为 error)。
- AST 基线冻结: any=0 / assertions=0 / doubleCasts=0。
