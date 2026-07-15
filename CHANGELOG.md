# CHANGELOG

All notable changes to CodeOmniVis. Format loosely follows Keep a Changelog.

## [Unreleased]

### Added

- Structured Issue Forms, CODEOWNERS, grouped Dependabot updates, CodeQL, Node 22/24 and Windows compatibility checks, plus a dated 93.50/100 quality reassessment.

### Changed

- The bilingual root README now prioritizes a visible Quick Start, four stable trust badges, a focused real-demo hero, compact evidence, MCP setup, and links to detailed documentation.
- Markdown now participates in the changed-file formatting gate; current security and licensing documentation is separated from clearly marked historical snapshots.

### Fixed

- AI destination policy now rejects semantically equivalent IPv4-mapped IPv6 private, loopback, and link-local forms plus expanded native IPv6 loopback/unspecified forms while comparing validated peers by normalized address value.
- Production parser dispatch skips test-only source paths without removing those files from static test intelligence.

## [0.1.0] — 2026-07-14

### Stage B · 前端能力套件 (#15–#20)

#### Added

- **跨语言测试智能**：静态发现 Vitest、Jest、Playwright、Cypress、JUnit 4/5 与 Kotest suite/case/fixture；新增 `tests`、`covers`、`uses_fixture` 图关系、Tests 工作台、`GET /api/tests`、MCP `get_test_coverage`、显式有界 `test-run` 与安全 JUnit XML `test-import`。
- **跨入口快照契约**：混合 TypeScript/Kotlin fixture 验证 Analyzer、CLI JSON、REST 与 MCP 的 `snapshotDigest` 及测试节点/边 ID 完全一致；1000 文件完整分析纳入 60 秒性能门禁。
- **可执行公共文档契约**：CLI、REST 与 MCP 文档中的 fenced inventory 会与实际注册表逐项比对，同时校验 workspace filters、AI 配置描述与 cal.com 实测证据；固定 cal.com revision `f00434927386c9ecdcbd7e6c5f82d22044a245bc` 完成 2,243 文件、3,223 节点、4,413 边、0 parse error 的 50.15 秒静态分析。
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

- 构建后的 analyzer 现在携带 Kotlin tree-sitter WASM，ESM 与内联 CLI 均通过 `import.meta.url` 定位资产，不再因缺少 `dist/wasm` 或未定义 `__dirname` 静默失去 Kotlin 分析。
- Vitest/Jest test adapter 改用轻量 TypeScript 单文件 AST，避免每个测试文件创建完整 `ts-morph Project`；本地 1000 文件基准由超过 95 秒降至约 1.2 秒。
- AI 请求契约前后端不一致(响应字段、配置缺失时的 501)。
- 文件变更在分析进行中被静默丢弃 — 现保证最终一致(rerunRequested)。
- `turbo.json` 增加 `globalPassThroughEnv: ["TMPDIR"]`,使 turbo 下的 vitest 继承沙箱临时目录。

### Stage A · 类型驱动设计 (A0–A9) — 已合并 master

- NodeMetadata / EdgeMetadata 改为封闭判别联合,移除 `Record<string,unknown>` fallback。
- 删除 `metadataValue()`,改用 `getRouteDisplay` / `getNodeRoute` + `isNodeOfType` 收窄。
- parser/storage 经 `createTypedNode` / `createTypedEdge` 工厂与 switch 复活器,零 cast。
- 落地 type-aware ESLint(`no-unsafe-*` + `no-explicit-any` 为 error)。
- AST 基线冻结: any=0 / assertions=0 / doubleCasts=0。
