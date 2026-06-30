# CodeOmniVis 全量只读审计报告

生成时间: 2026-06-30

审计范围: `packages/{shared,analyzer,server,cli,mcp,ui}/src` 与 `__tests__`，并交叉核对 `shared` 契约、历史台账 `loop/BASELINE.json`、`loop/PROGRESS.json`、`TECHNICAL_DEBT.md`、`DELIVERY_REPORT.md`。

排除口径: 已闭合 H0-H15 不重复计入；已登记保留的 B-2 `MODULE_TYPELESS_PACKAGE_JSON` 与 B-4 `unknown` 运行时边界不计入缺陷数。本报告仍标注 TECHNICAL_DEBT 中未闭合且可定位到源码的 B-5/B-6/B-7。

## 1. 门禁现状

| 门禁 | 命令 | 本次结果 | 备注 |
|---|---|---:|---|
| typecheck | `TMPDIR="$PWD/.loop_tmp/tmpdir"; export TMPDIR; /Users/new/.local/bin/pnpm turbo typecheck lint build test --force` | 通过 | turbo 合并门禁 24/24 tasks successful |
| lint | 同上 | 通过 | 仍打印 6 条已登记 B-2 `MODULE_TYPELESS_PACKAGE_JSON` Node 警告，0 lint error |
| build | 同上 | 通过 | UI 最大 chunk `vendor-cytoscape` 443.74KB，未触发 500KB 警告 |
| test | 同上 | 通过 | 378 用例基线延续；本次 turbo 输出 24/24 tasks successful |
| ast-scan | `TMPDIR="$PWD/.loop_tmp/tmpdir"; export TMPDIR; node loop/ast-scan.cjs` | 通过 | `any=0 unknown=83 assertions=0 doubleCasts=0 recordUnknown=1` |

补充: 当前 shell 初始 `PATH` 未包含 `pnpm`，直接 `pnpm turbo ... --force` 与本地 `./node_modules/.bin/turbo ... --force` 首次均无法启动包管理器；定位到现有 `/Users/new/.local/bin/pnpm` 9.0.0 后重跑通过。

## 2. 缺陷清单

| 编号 | 严重度 | 包 | 文件:行号 | 问题描述 | 影响 | 最小修复建议 | 回归测试覆盖 |
|---|---|---|---|---|---|---|---|
| S-05 | High | server | `packages/server/src/pathGuard.ts:23-28`, `packages/server/src/index.ts:124-152`, `packages/server/src/incremental.ts:88-92` | `/api/project` 只用 `path.resolve/path.relative` 做边界校验，随后 `fs.statSync(...).isDirectory()` 会跟随 symlink；边界内 symlink 可指向边界外目录。 | 绕过 H3 的路径边界，触发 watcher/analyzer 扫描项目根外文件。 | 对 boundary 和候选路径使用 `fs.realpathSync.native` 后再比对，或 `lstat` 直接拒绝 symlink。 | 无。`routes/pathTraversal.test.ts:47-95` 覆盖 `../`/绝对路径/合法子路径，未覆盖 symlink。 |
| S-06 | Med | shared/server | `packages/shared/src/types/ai.ts:70-135`, `packages/server/src/ai.ts:73-99` | AI SSRF guard 明确只做 URL 字面量判断，不解析 DNS；公共 HTTPS 域名若解析到内网/metadata 地址会放行并进入 `fetch()`。TECHNICAL_DEBT B-5 存续。 | 可通过 DNS 解析绕过私网地址黑名单，形成 SSRF 到内部 HTTPS 服务。 | 请求前解析 hostname 并拒绝私网/链路本地/metadata 解析结果；避免 DNS rebinding，必要时使用 provider allowlist。 | 部分。`shared/__tests__/types/ai.test.ts:95-115` 与 `server/__tests__/routes/ai.test.ts:93-120` 只覆盖字面量 IP/协议。 |
| S-07 | Med | cli/server | `packages/cli/src/commands/serve.ts:48-77`, `packages/server/src/index.ts:110-165`, `packages/server/src/routes/graph.ts:225-252` | CLI 允许 `--host 0.0.0.0`，server 端 mutating endpoints (`/api/analyze`, `/api/project`, `DELETE /api/graph`) 无鉴权，`DELETE` 仅依赖可伪造 `X-Confirm: true`。 | 绑定到局域网/公网后，未授权调用者可触发扫描、切根或清空图数据；CORS 不是服务端鉴权。 | 非 loopback 绑定要求显式访问 token；对 mutating endpoints 校验 `Authorization` 或本地 secret。 | 反向覆盖。`routes/graph-extended.test.ts:83-96` 验证仅凭 `X-Confirm` 即可清空。 |
| S-08 | Med | cli/mcp/analyzer | `packages/cli/src/utils/autoDetect.ts:520-550`, `packages/cli/src/commands/serve.ts:101-105`, `packages/cli/src/commands/analyze.ts:66-70`, `packages/mcp/src/index.ts:73-79`, `packages/analyzer/src/graph/runFullAnalysis.ts:143-172` | `collectScanDirs` 与 `runFullAnalysis` 默认加入 `../frontend/src`、`../frontend`；用户指定 `--project`/`CODEOMNIVIS_PROJECT` 后，实际扫描边界可越过项目根。 | 扫描并缓存相邻仓库/目录文件，导致结果污染或意外暴露。 | 默认只扫描 projectRoot 内路径；sibling frontend 仅在显式配置或确认 monorepo 根时启用，并用 subpath 校验拒绝逃逸。 | 无。现有 `scanDirectory`/`autoDetect` 测试未覆盖 sibling 越界。 |
| S-09 | Low | ui/shared | `packages/shared/src/types/ai.ts:17-21`, `packages/ui/src/lib/aiConfig.ts:80-90`, `packages/ui/src/lib/aiConfig.ts:141-150` | apiKey 仍由浏览器保存并随请求体下发；默认 sessionStorage，用户勾选记住时落 localStorage。TECHNICAL_DEBT B-6 存续。 | XSS/本机多用户场景下凭据暴露面仍在前端。 | 高安全场景改为服务端会话托管或短期 token，前端不持有长期密钥。 | 有存储拆分测试，但没有凭据泄漏防护测试。 |
| BOUND-04 | High | mcp/analyzer | `packages/mcp/src/index.ts:111-118`, `packages/mcp/src/index.ts:291-307`, `packages/analyzer/src/storage/db.ts:996-1008` | MCP `depth` 接受 `"Infinity"`、超大值、负数等；`getSubtree` 只在 `maxDepth === 0` 停止，且无 visited。循环 `renders` 图会无限递归。 | 单次 MCP 工具调用可造成 CPU/栈 DoS，卡死 stdio MCP server。 | 对 depth 做 finite/integer/range 校验；非法值返回 MCP error；`getSubtree` 增加 visited 与硬上限。 | 无。`mcp/__tests__/tools.test.ts:10-29` 复制模拟逻辑，不覆盖真实 handler/参数边界。 |
| BOUND-05 | Med | analyzer | `packages/analyzer/src/resolver/dataFlowTracer.ts:82-90`, `packages/analyzer/src/resolver/dataFlowTracer.ts:221-253` | `traceModelFlow()` 调用的 `findParentApiRoutes()` 沿 `calls_service` 递归上溯时没有 visited/depth 边界。 | 服务调用图有环时数据流追踪栈溢出，影响 UI/MCP 数据流入口。 | 为 `findParentApiRoutes(node, visited, depth)` 加 visited 与最大深度；遇环停止。 | 无。现有 `dataFlowTrace.test.ts` 只覆盖 `traceFromNode` 的 64 步预算。 |
| E-07 | Med | server | `packages/server/src/incremental.ts:251-284`, `packages/server/src/index.ts:112-119`, `packages/server/__tests__/incremental/incremental.test.ts:102-107` | `runAnalysisCycle` 捕获分析异常后不 rethrow，`refresh()` 总是 resolve；`POST /api/analyze` 因此在分析失败时仍返回 success。测试还断言失败后回到 `fresh`。 | 手动刷新失败会被 UI/API 误报成功，图数据可能仍旧但状态显示 fresh。 | 区分 watcher 自动重试与手动刷新；手动刷新失败应 reject 或返回失败状态，并保持 stale/error。 | 反向覆盖。测试把错误吞掉作为期望。 |
| E-08 | Med | analyzer/server | `packages/analyzer/src/resolver/crossLayer.ts:459-475`, `packages/analyzer/src/resolver/crossLayer.ts:597-613`, `packages/analyzer/src/graph/runAnalysis.ts:134-143`, `packages/analyzer/src/storage/db.ts:423-442` | `CrossLayerLinker.link()` 会向 `graph.nodes` push synthetic handler/service 节点；`runAnalysis` 只 `upsertEdges`，不写入新增节点，且 DB 写边时临时关闭 FK。 | server 增量分析落库 dangling edge，查询层 `sanitizeGraph` 会移除这些边，跨层链路丢失。 | 让 `CrossLayerResult` 返回新增节点，或 link 后 upsert synthetic nodes，且节点先于边写入。 | 无。H1 只验证分析结果可达查询层，不校验 synthetic 节点与边端点完整性。 |
| E-09 | Low | analyzer | `packages/analyzer/src/graph/runFullAnalysis.ts:248-257`, `packages/analyzer/src/graph/runFullAnalysis.ts:268-274` | `runFullAnalysis` 实际计算并写入 cross-layer edges，但返回 `crossLayerEdges: 0` 硬编码。 | CLI/MCP/监控无法信任跨层连线计数，报告误导。 | 返回 `crossLayerResult.edges.length`，无文件分支显式保持 0。 | 无。相关 server 测试多为 mock `runAnalysis`。 |
| E-10 | Med | shared/analyzer | `packages/shared/src/types/graph.ts:49-50`, `packages/analyzer/src/parsers/index.ts:18-23`, `packages/analyzer/src/graph/createDefaultParsers.ts:28-43`, `packages/analyzer/src/graph/runAnalysis.ts:40-48`, `packages/analyzer/src/graph/runFullAnalysis.ts:125-135` | shared 契约和 parser registry 支持 Kotlin/Spring/Ktor/Room/Exposed，但默认 parser factory 不注册 Kotlin parsers，扫描入口也不收集 `.kt`。 | Kotlin 项目通过默认分析链路不可达，契约与实现漂移。 | 默认工厂纳入 Kotlin parsers；扫描扩展 `.kt`；入口复用统一 parser factory 与项目探测。 | 部分。只有 Kotlin parser 单测，无默认分析入口覆盖。 |
| E-11 | Med | shared/cli | `packages/shared/src/utils/configLoader.ts:14-35`, `packages/cli/src/utils/autoDetect.ts:46-59`, `packages/cli/src/utils/autoDetect.ts:523-528` | `loadConfig` 只判断顶层 object，嵌套字段未收窄；如 `frontend.dirs` 为字符串时会流入 `.map()`。 | 畸形 `.codeomnivis.json` 可让 analyze/serve 崩溃，违背“配置失败降级”注释。 | 增加完整运行时 config guard，非法字段丢弃或返回诊断；不要把未验证嵌套对象合并进业务层。 | 无。未见 configLoader 畸形配置测试。 |
| E-12 | Low | ui | `packages/ui/src/App.tsx:43-44`, `packages/ui/src/hooks/useSearch.ts:18-32`, `packages/ui/src/App.tsx:125-149` | `useSearch` 计算 `searchFilteredNodes`，但 `App` 只消费 `query/setQuery`；Sidebar 与 GraphCanvas 仍接收原始 graph。 | Header 搜索框可输入但不影响画布/列表，功能不可用。 | 派生 filtered graph 传给 Sidebar/GraphCanvas，或改为搜索定位/高亮并删除未用过滤结果。 | 无。未见搜索行为测试。 |
| E-13 | Med | ui | `packages/ui/src/hooks/useGraphFilter.ts:36-79`, `packages/ui/src/components/GraphCanvas.tsx:151-164` | 过滤 effect 依赖 `[state, cyRef]`；GraphCanvas 在 graph 刷新时 `remove/add` 全部元素并重新布局，但过滤 state 不变时不会重放过滤。 | WebSocket/手动刷新后，新元素恢复默认可见，UI 过滤状态与画布不一致。 | 将图版本/元素更新纳入过滤重放，或 GraphCanvas 更新后调用当前 filter state。 | 无。未见 filter + graph refresh 组合测试。 |
| LEAK-02 | Low | server | `packages/server/src/index.ts:270-287` | `start()` 在 `server.listen()` 前启动 watcher 并注册信号处理器；Promise 只在 listen callback resolve，没有 `error` reject/cleanup。 | 端口占用/非法 host 等 listen error 不会走可控 reject/cleanup 路径，可能触发未处理 error，并遗留已启动的 watcher/进程监听器。 | 监听 `server.once('error')`，失败时 cleanup 并 reject；建立 start 状态机防重复启动。 | 无。`lifecycle/close.test.ts:23-46` 只覆盖正常 start/stop。 |
| LEAK-03 | Low | server | `packages/server/src/events.ts:1-3`, `packages/server/src/index.ts:233-254`, `packages/server/src/index.ts:310-311` | 多个 server 实例共享全局 `codeomnivisEvents`；单个 `stop()` 调用 `removeAllListeners()`，会删掉其他实例/外部订阅者监听。 | 同进程多实例或测试嵌入场景中，停止一个实例会让其他实例 WS 广播/状态通知静默失效。 | 保存本实例 listener 引用，stop 时只 `off(event, listener)`；避免全局 removeAll。 | 无多实例覆盖。 |
| LEAK-04 | Med | ui | `packages/ui/src/hooks/useWebSocket.ts:60-69`, `packages/ui/src/hooks/useWebSocket.ts:85-91` | cleanup 关闭 socket 后，`onclose` 仍因闭包 `enabled === true` 重新 `setTimeout(connect, 3000)`。 | 组件卸载、StrictMode 试挂载或页面切换后可能留下重连定时器/WebSocket，并在卸载后 setState。 | 增加 `disposedRef/shouldReconnectRef`；cleanup 先禁用重连，再 close；onclose 仅非主动关闭时重连。 | 无。未见 `useWebSocket` 清理测试。 |
| LEAK-05 | Low | cli | `packages/cli/src/commands/analyze.ts:43-47`, `packages/cli/src/commands/analyze.ts:171-176`, `packages/cli/src/commands/check.ts:32-35`, `packages/cli/src/commands/check.ts:116-121` | `analyze`/`check` 创建 DB 后只在成功路径 `db.close()`；后续解析/连线/写文件异常直接 `process.exit(1)`。 | 异常路径 DB 未持久化/释放，集成调用中可能留下资源或丢失已写内容。 | `db` 提升到 try 外并在 `finally` 关闭；入口统一处理 exit。 | 无 CLI 命令失败路径测试。 |
| DUP-04 | Low | cli | `packages/cli/src/commands/check.ts:49-55`, `packages/cli/src/commands/analyze.ts:65-70`, `packages/cli/src/utils/autoDetect.ts:520-582` | `check` 命令仍用硬编码扫描目录，不复用 `collectScanDirs`，也不支持配置目录/monorepo packages。 | `codeomnivis check` 与 analyze/serve 覆盖面漂移，可能漏报。 | `check` 复用 `collectScanDirs(projectRoot, config)`，并补配置目录/monorepo 测试。 | 无。现有 CLI 测试只覆盖 utils。 |
| PERF-02 | Low | server/analyzer | `packages/server/src/incremental.ts:251-258`, `packages/analyzer/src/graph/runAnalysis.ts:106-115` | 文件变化后仍调用全量 `runAnalysis`，未做文件级增量 AST diff/cache。TECHNICAL_DEBT B-7 存续。 | 大型仓库每次变更成本高，watch 模式响应慢。 | 后续方案引入文件级缓存、增量 parser、受影响子图更新。 | 有新鲜度/不丢变更测试，无性能基准或增量覆盖。 |
| TEST-BUG-04 | Low | mcp | `packages/mcp/__tests__/tools.test.ts:10-29`, `packages/mcp/src/index.ts:291-307` | MCP 测试复制简化逻辑，不调用真实 tool handlers；真实 `depth` 参数边界和 `getSubtree` 路径完全未覆盖。 | 测试全绿但无法发现 BOUND-04 一类真实 MCP 输入缺陷。 | 导出纯 handler 或通过 MCP server transport/调用入口做集成测试，覆盖非法参数。 | 当前为假覆盖。 |

## 3. 疑似 / 待验证

| 编号 | 严重度 | 包 | 文件:行号 | 说明 | 待验证方式 |
|---|---|---|---|---|---|
| Q-01 | Low | analyzer | `packages/analyzer/src/resolver/symbolResolver.ts:89-99`, `packages/analyzer/src/resolver/symbolResolver.ts:122-164` | `Promise.race` 超时保护无法中断同步 AST/递归 CPU 工作；但该路径另有 `MAX_DEPTH` 和 visited，需用大文件压测确认实际阻塞程度。 | 构造大调用图 benchmark，验证 timeout 是否按预期生效。 |
| Q-02 | Low | server | `packages/server/src/routes/graph.ts:109-112`, `packages/server/src/routes/graph.ts:139-142` | Express 已解码 route param，二次 `decodeURIComponent` 遇合法 `%` 字符可能抛 `URIError` 转 500。 | 增加含 `%` 的节点 ID 路由测试，确认 Express param 行为。 |
| Q-03 | Low | server | `packages/server/src/ai.ts:52-64` | AI 上游 `fetch()` 无超时/AbortSignal，故障上游可长时间占住请求。 | 用悬挂 fetch mock/集成测试确认请求资源占用。 |
| Q-04 | Low | ui | `packages/ui/src/components/Graph/NodeTooltip.tsx:55-69` | `mouseover` 启动新 timer 前未清理旧 timer；是否可多 timer 竞争取决于 Cytoscape 事件语义。 | 模拟连续 mouseover 无 mouseout，验证 tooltip 状态竞争。 |
| Q-05 | Low | cli | `packages/cli/src/commands/serve.ts:181-198` | CLI `serve` 仅在最后注册 `SIGINT`，未处理 `SIGTERM`；分析或打开浏览器失败后没有 `finally server.stop()`。 | 增加 serve 命令异常路径测试，确认 server/watcher 是否泄漏。 |

## 4. 严重度汇总

| 严重度 | 数量 | 编号 |
|---|---:|---|
| Blocker | 0 | - |
| High | 2 | S-05, BOUND-04 |
| Med | 10 | S-06, S-07, S-08, BOUND-05, E-07, E-08, E-10, E-11, E-13, LEAK-04 |
| Low | 9 | S-09, E-09, E-12, LEAK-02, LEAK-03, LEAK-05, DUP-04, PERF-02, TEST-BUG-04 |

确认缺陷总数: 21。疑似/待验证: 5。

## 5. 修复优先级建议

1. 先修 High: S-05 symlink 边界绕过、BOUND-04 MCP depth/getSubtree DoS。
2. 修安全暴露面: S-07 非 loopback 无鉴权、S-08 sibling 越界扫描、S-06 DNS SSRF 绕过。
3. 修数据正确性: E-08 synthetic 节点落库、E-07 手动分析失败状态、E-10 Kotlin 默认链路不可达。
4. 修终止性与生命周期: BOUND-05 dataflow 环递归、LEAK-04 UI WebSocket 重连泄漏、LEAK-02/03/05 资源释放边界。
5. 修契约/UX/测试债: E-11 config guard、E-13 过滤刷新、E-12 搜索不可用、DUP-04 check 扫描漂移、TEST-BUG-04 MCP 真集成覆盖。
6. 延后治理已知低风险债: S-09 前端持有 apiKey、PERF-02 全量重分析方案一。

## 6. 与上一轮差异

新增确认缺陷: S-05, S-07, S-08, BOUND-04, BOUND-05, E-07, E-08, E-09, E-10, E-11, E-12, E-13, LEAK-02, LEAK-03, LEAK-04, LEAK-05, DUP-04, TEST-BUG-04。

TECHNICAL_DEBT 中仍存续且本轮复核仍成立: S-06 对应 B-5，S-09 对应 B-6，PERF-02 对应 B-7。

明确排除不计数: B-2 `MODULE_TYPELESS_PACKAGE_JSON` 仍在 lint 输出中出现但已登记保留；B-4 `unknown=83` 与 `recordUnknown=1` 符合边界策略，本轮未发现非边界混入。
