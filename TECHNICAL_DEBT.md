# 技术债务 (TECHNICAL DEBT)

> 截至 2026-06-30,Stage A+B 交付后已知债务清单。所有项均为非阻塞,记录以备后续治理。

## 1. ESLint 历史警告(unused-vars,0 error)

类型感知 lint 在 A9 落地时仅将 `no-unsafe-*` / `no-explicit-any` 设为 error,未清理存量未使用变量警告,以免扩大单次改动面。

| 包 | 警告数 | 说明 |
|---|---|---|
| analyzer | ~33 | 多为解析器中预留但未消费的中间变量 |
| cli | 3 | 命令注册处预留参数 |
| ui | 2 | `GraphCanvas.tsx` 未使用的 `useCallback` 导入;`Header.tsx` 未使用的 `refreshError` |

**建议**: 单独开一个 chore 任务批量清理,或逐包将 `no-unused-vars` 升级为 error 后修复。

## 2. UI 产物体积告警

UI 构建产物单 chunk **约 746KB**,超过 Vite 默认 500KB 警告阈值。主要来自 cytoscape 及其布局插件。

**建议**: 引入 `manualChunks` 拆分 cytoscape / react-query / i18next,或对图谱视图做动态 `import()` 懒加载。

## 3. AST unknown=86(运行时边界,非债务但需守护)

`unknown` 计数为 86,全部位于运行时边界(HTTP 响应 JSON、cytoscape `data()` 读取、localStorage 反序列化、Express `req.body`)。这是类型安全策略的**预期结果**:边界处先标 `unknown` 再用守卫收窄,优于 `any` 或 cast。

**注意**: 该计数应只在新增真实边界时上升。AST 门禁已锁定 any=0 / assertions=0 / doubleCasts=0;若 unknown 因非边界代码上涨,应视为回归。

## 4. AI 上游为用户自配置端点

AI 对话/解释功能依赖用户在设置抽屉填写的 OpenAI 兼容 `baseUrl/apiKey/model`(存于 localStorage)。未配置时返回 501。

**注意**: apiKey 以明文存于浏览器 localStorage;后续若需更高安全等级,可考虑服务端代理 + 会话级凭据,但当前设计刻意避免任何内部网关耦合。

## 5. 数据新鲜度为"方案一"

B17 实现的是方案一(状态可视化 + 智能监听 + 手动兜底 + 序列化重分析)。大型仓库下的全量重分析仍是粗粒度;增量 AST diff / 文件级缓存属后续方案。

## 6. 测试环境约束

vitest 依赖 `TMPDIR` 指向可写目录(sql.js / 临时 DB)。CI 或本地若 `/tmp` 不可写,需显式 `export TMPDIR=...`;turbo 下已由 `globalPassThroughEnv` 透传。UI vitest 运行于 node 环境(无 jsdom),React 组件本身不可直接单测,故逻辑须下沉至纯 lib。
