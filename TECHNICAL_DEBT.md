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

### B-1. ESLint 历史警告(unused-vars,0 error)

类型感知 lint 在 A9 落地时仅将 `no-unsafe-*` / `no-explicit-any` / `no-unsafe-finally` 设为 error,未清理存量未使用变量警告,以免扩大单次改动面。

| 包 | 警告数 | 说明 |
|---|---|---|
| analyzer | ~33 | 多为解析器中预留但未消费的中间变量 |
| cli | 3 | 命令注册处预留参数 |
| ui | 2 | `GraphCanvas.tsx` 未使用的 `useCallback` 导入;`Header.tsx` 未使用的 `refreshError` |

**建议**: 单独开一个 chore 任务批量清理,或逐包将 `no-unused-vars` 升级为 error 后修复。

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

### B-3. UI 产物体积告警

UI 构建产物单 chunk **约 750KB**,超过 Vite 默认 500KB 警告阈值。主要来自 cytoscape 及其布局插件。

**建议**: 引入 `manualChunks` 拆分 cytoscape / react-query / i18next,或对图谱视图做动态 `import()` 懒加载。

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
