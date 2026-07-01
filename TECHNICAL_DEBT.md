# 技术债务 (TECHNICAL DEBT)

> 截至 2026-06-30,Stage A+B 交付并经一轮独立代码评审后的状态清单。
> 本文档分两部分:**A. 评审发现并已修复的缺陷**(已闭环,仅留痕);**B. 仍存续的已知债务**(未修复,按严重度记录)。
> 注意:并非所有项都"非阻塞"——评审发现的 B1/B2 属安全/正确性缺陷,已在 `fix/review-remediation` 分支修复合并;B 部分多为工程优化项。

---

## A. 评审发现并已修复的缺陷(已闭环)

| 编号 | 等级 | 问题 | 修复提交 |
|---|---|---|---|
| B1 | 🔴 Blocker | `tsrpc_api.conf` 使用 `Record<string, unknown>` 宽回退;且 AST 扫描器从不统计 `Record<string,unknown>`(检测盲区,导致"无宽回退"结论失真) | `c2abd9b` (R1) |
| B2 | 🔴 Blocker | `/api/ai/chat`、`/api/ai/explain` 将 `Bearer apiKey` 转发到任意 `baseUrl`,构成开放代理 / SSRF 面 | `456e8f1` (R2) |
| M1 | 🟠 Major | `setProjectRoot()` 未与在途分析串行化、未 `await watcher.close()`,切根后旧分析可能把旧项目数据 upsert 回已清空的 DB | `6e9cc2e` (R3) |
| M2 | 🟠 Major | 全链路 trace 上/下游各 64 步,总步数最坏可达 129,超出预期上界 | `6e9cc2e` (R3) |
| M3 | 🟠 Major | `SettingsDrawer` 与 `AiPanel` 各自 `useState(loadAiConfig())` 复制 AI 配置,易状态漂移 | `aa972ef` (R4) |
| M4 | 🟠 Major | `apiKey` 明文常驻 `localStorage` | `aa972ef` (R4) |

**已闭合的检测盲区**:AST 扫描器(`loop/ast-scan.cjs`)在 R1 起新增 `recordUnknown` 计数。当前 `recordUnknown=1`,为 `packages/analyzer/src/parsers/prisma.ts` 中用于收窄"JS 模块命名空间(含函数值)"的 `isRecord` 守卫——这是合法的非 JSON 边界,语义上不能替换为 `JsonObject`,故保留并在此明示为唯一允许项。

---

## B. 仍存续的已知债务(未修复)

### B-1. ESLint 历史警告(unused-vars,0 error)— ✅ 已闭合(H14 / E-06,commit 012dbe9)

类型感知 lint 在 A9 落地时仅将 `no-unsafe-*` / `no-explicit-any` / `no-unsafe-finally` 设为 error,遗留 38 条未使用变量警告(analyzer 33 / cli 3 / ui 2)。H14 已全部清零:

- 删除未使用导入(ts-morph `SyntaxKind`/`CallExpression`/`SourceFile` 等、shared 侧 `EdgeType`/`DbRelationMetadata`/`TrpcProcedureMetadata`/`IssueLocation`、node `path`)。
- 删除未使用局部(`createEdgeId`、prisma `relation`、builder 中仅取返回值的 `nodesSaved`/`edgesSaved` 改为保留副作用调用)。
- 删除死代码(builder 空的 renders 循环、cli `scanForRouters` 无调用方函数)。
- 未使用形参以 `_` 前缀匹配 `/^_/u`(`_filePath`/`_projectRoot`/`_nodeMap`/`_fromFile`)。
- `consistency.ts` 改用 `const [, proc]`;`scanDirectory.ts` 改用可选 catch。
- UI:移除 `GraphCanvas` 未使用的 `useCallback`;`Header.tsx` 将此前被捕获但从未渲染的 `refreshError` 通过 `role="alert"` 渲染(顺带修复刷新失败无提示的隐性 UX 缺陷)。

**当前**: `pnpm turbo lint` → 0 error / 0 warning。

### B-2. `MODULE_TYPELESS_PACKAGE_JSON` 警告(6 条)

运行 lint 时 6 个包各产生 1 条 Node 警告:`eslint.config.js` 未声明模块类型,Node 先按 CommonJS 解析失败再回退为 ES module,带来一次性解析开销。

```
packages/shared   1
packages/analyzer 1
packages/server   1
packages/mcp      1
packages/cli      1
packages/ui       1
```

**根因**: 根 `package.json` 未声明 `"type": "module"`,而 `eslint.config.js` 使用 ESM 语法。
**建议**: 在根 `package.json` 加 `"type": "module"`(需同步核对各包 CJS 脚本/配置是否受影响),或将 `eslint.config.js` 改名为 `eslint.config.mjs`。属纯告警,不影响 lint 结果。

### B-3. UI 产物体积告警 — ✅ 已闭合(H15 / P-01,commit 1ae40b5)

此前 UI 构建产物为单 chunk **749.10KB**,超过 Vite 默认 500KB 警告阈值。H15 在 `vite.config.ts` 增加 `build.rollupOptions.output.manualChunks(id)`,按 `node_modules` 来源拆分:

| chunk | 体积 | gzip |
|---|---|---|
| index(应用代码) | 73.70KB | 21.73KB |
| vendor-cytoscape | 443.74KB | 142.39KB |
| vendor-react | 146.86KB | 47.75KB |
| vendor-i18n | 44.33KB | 14.18KB |
| vendor-query | 38.70KB | 11.73KB |
| vendor | 1.13KB | 0.64KB |

**结果**: 主应用 chunk 由 749KB 降至 73.7KB,无 chunk 触发 500KB 告警。`vendor-cytoscape`(图谱引擎)为最大第三方块,后续可进一步对图谱视图做动态 `import()` 懒加载。

### B-4. AST `unknown` 计数(运行时边界,非债务但需守护)

`unknown` 计数约 81,全部位于运行时边界(HTTP 响应 JSON、cytoscape `data()` 读取、localStorage/sessionStorage 反序列化、Express `req.body`)。这是类型安全策略的**预期结果**:边界处先标 `unknown` 再用守卫收窄,优于 `any` 或 cast。

**注意**: 该计数应只在新增真实边界时上升。AST 门禁已锁定 `any=0 / assertions=0 / doubleCasts=0 / recordUnknown=1`;若 `unknown` 因非边界代码上涨,应视为回归。

### B-5. AI 上游 SSRF 默认策略为"本地开发假设"

R2 已加入 `validateUpstreamBaseUrl`:拦截私网/链路本地/元数据地址,非环回地址强制 https,默认放行 `localhost`(适配本地开发工具场景)。

**注意**: 若本工具被部署到共享/对外暴露的主机,仅靠 URL 字面校验不足以防御(无 DNS 解析校验、无服务端 provider allowlist)。此时应改为服务端代理 + provider 白名单 + 会话级凭据。当前刻意避免任何内部网关耦合。

### B-6. apiKey 存储仍在浏览器侧

R4 已将 `apiKey` 默认降级为 `sessionStorage`(随标签页失效),仅在用户显式勾选"记住密钥"时落 `localStorage`。但凭据仍在浏览器侧,未做服务端托管。

**建议**: 更高安全等级场景应改为服务端会话托管,前端不持有长期凭据。

### B-7. 数据新鲜度为"方案一"

B17 实现的是方案一(状态可视化 + 智能监听 + 手动兜底 + 序列化重分析)。大型仓库下的全量重分析仍是粗粒度;增量 AST diff / 文件级缓存属后续方案。

### B-8. 测试环境约束

vitest 依赖 `TMPDIR` 指向可写目录(sql.js / 临时 DB)。CI 或本地若 `/tmp` 不可写,需显式 `export TMPDIR=...`;turbo 下已由 `globalPassThroughEnv` 透传。UI vitest 运行于 node 环境(无 jsdom),React 组件本身不可直接单测,故逻辑须下沉至纯 lib(`lib/aiConfig.ts` 的纯函数即按此约束设计)。


---

## C. 第二轮独立审计修复(F1–F19,分支 fix/audit-round2,2026-07-01)

> 在 Stage A+B 与首轮评审(A 部分)之后,对仓库做了第二轮独立深度审计(见 `loop/AUDIT_REPORT.md`),发现 19 项可修复缺陷(安全 / 资源泄漏 / 正确性 / 重复逻辑 / 测试失真)。全部以「RED→GREEN→全门禁→单一绿色提交」流程闭环,逐项推送。详见 `loop/DELIVERY_REPORT.md`。

| 编号 | 审计项 | 等级 | 包 | 提交 | 修复要点 |
|---|---|---|---|---|---|
| F1 | S-05 | High | server | `49f831c` | realpath 二次边界校验,拒绝边界内符号链接逃逸根目录 |
| F2 | BOUND-04 | High | mcp/analyzer | `e6b6870` | validateDepth 拒绝非法 MCP 深度;getSubtree 限深 + visited 去重 |
| F3 | S-07 | Med | cli/server | `f46abe6` | 非环回绑定强制 token;变更端点 timingSafeEqual 鉴权 |
| F4 | S-08 | Med | cli/analyzer | `8edc180` | collectScanDirs 默认只扫 projectRoot 内,跨目录须显式配置 |
| F5 | S-06 | Med | shared/server | `a3e3e2d` | DNS rebinding 防护:fetch 前解析主机名,拒私网/元数据/环回 |
| F6 | E-08 | Med | analyzer | `0ad80fe` | 跨层连线返回 synthetic 节点并先 upsert,消除 dangling edge |
| F7 | E-07 | Med | server | `93d1e54` | 区分手动刷新与自动重试;手动失败保持 stale 并 rethrow(500);`b2bca77` 为 ledger-only 推进提交 |
| F8 | E-10 | Med | shared/analyzer/cli | `1334aa5` | 默认解析器纳入 Kotlin/Spring/Ktor/Room/Exposed,Gradle 探测 |
| F9 | BOUND-05 | Med | analyzer | `073a737` | findParentApiRoutes visited 阻断环;MAX_PARENT_ROUTE_DEPTH=64 |
| F10 | LEAK-04 | Med | ui | `5930b7a` | WebSocketController 状态机:dispose 先禁重连再 close,防卸载后重连 |
| F11 | LEAK-02 | High | server | `acb81e5` | start() 监听失败不再永久挂起:同步 reject + 清理钩子 |
| F12 | LEAK-03 | High | server | `008ecde` | stop() 不再 removeAllListeners 清空共享单例事件总线 |
| F13 | LEAK-05 | Med | cli | `b6b6fe3` | runAnalyze/runCheck:db 句柄 finally close,异常路径不泄漏 |
| F14 | E-11 | Med | shared/cli | `78d7488` | loadConfig 逐字段运行时校验,非法配置回退默认不污染下游 |
| F15 | E-13 | Med | ui | `141d06d` | GraphFilterController 监听 cytoscape 'add',刷新后重放过滤 |
| F16 | E-12 | Low | ui | `8a072b9` | filterNodesByQuery:Header 搜索框实际过滤节点列表/计数 |
| F17 | E-09 | Low | analyzer | `50aa2f5` | runFullAnalysis 返回真实跨层边数,不再硬编码 0 |
| F18 | DUP-04 | Low | cli | `b58a16c` | check 命令复用 collectScanDirs,消除硬编码扫描目录与 cwd 漂移 |
| F19 | TEST-BUG-04 | Low | mcp | `149b146` | tools.test 改为断言真实导出的 MCP handler,而非简化复刻逻辑 |

**最终全量回归(37 commits ahead of `578d7fe`,ff-only 合并;实测命令:`git rev-list --count 578d7fe..HEAD`,base..HEAD=`578d7fe..ea25945`)**:
- 测试:439 passed(shared 88 / ui 53 / analyzer 197 / mcp 19 / cli 18 / server 64)
- 类型检查:`pnpm turbo typecheck --force` → `Tasks: 11 successful, 11 total`
- lint:`pnpm turbo lint --force` → `Tasks: 6 successful, 6 total`;6 条均为允许的 B-2 `MODULE_TYPELESS_PACKAGE_JSON` 告警,exit 0
- build:`pnpm turbo build --force` → `Tasks: 6 successful, 6 total`
- 计数说明:turbo 仅为定义了该 script 的包调度任务,故计数不等于 6 个包全量
- AST 门禁:`any=0 unknown=92 assertions=0 doubleCasts=0 recordUnknown=1`(`unknown` 全为运行时边界,见 B-4)

**刻意保留的债务(本轮不修)**:
- **S-09 → B-6**:apiKey 仍在浏览器侧。属架构级改造(服务端会话托管),超出本轮「单缺陷最小修复」范围,保留为 B-6。
- **PERF-02 → B-7**:大型仓库全量重分析为粗粒度(方案一)。增量 AST diff / 文件级缓存属后续方案,保留为 B-7。
