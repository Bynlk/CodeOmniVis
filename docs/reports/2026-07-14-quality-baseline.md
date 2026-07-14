# CodeOmniVis 90 分质量工程基线

## 冻结范围

- 基线提交：`fd86f489bf917d853bda95c7c06515b6167aaa3d`
- 基线分支：`master`，跟踪 `origin/master`
- 首次评估总分：68.75/100
- 记录日期：2026-07-14（Asia/Shanghai）

这份记录冻结质量工程启动前的事实。后续验证在隔离分支进行，不用新的实现结果回写或美化本基线。

## 已通过证据

| 检查 | 命令 | 基线结果 |
|---|---|---|
| 全量测试 | `pnpm exec turbo test --force` | 649 项测试通过；12/12 Turbo 任务成功 |
| 构建、类型与 lint | `pnpm exec turbo run build typecheck lint --force` | 18/18 非缓存任务通过 |
| README 契约 | `pnpm verify:readme` | 通过 |
| tarball 隔离安装 | `pnpm verify:package` | 通过；可在临时目录安装并启动 demo |
| 包内容 | `npm pack --dry-run --json --registry=https://registry.npmjs.org` | 26 个文件，约 1.36 MB 压缩、约 8 MB 解压 |

## 已确认缺口

| 项目 | 复现命令或证据 | 基线结果 |
|---|---|---|
| MCP CLI 生命周期 | `node packages/cli/bin/codeomnivis.js mcp --project demo` | 显示启动成功后约 0.8 秒退出；动态 import 没有调用 MCP direct-entry `main()` |
| CI 默认分支 | `git branch -r` 与 `.github/workflows/ci.yml` | 远端使用 `master`，CI 只监听不存在的 `main` |
| 覆盖率 | `pnpm exec vitest run --coverage` | 失败：缺少 `@vitest/coverage-v8` |
| 浏览器 E2E | 测试目录与依赖清单 | 没有真实浏览器 E2E |
| 解析器契约 | NestJS/Drizzle 测试清单 | 两者缺少独立正常、异常、边界行为测试 |
| 分析入口 | `runAnalysis.ts` 与 `runFullAnalysis.ts` | 两套项目探测与扫描路径，可产生漂移 |
| 维护成本 | 生产源码统计 | 167 个文件、约 24,072 行；22 个文件超过 300 行，`storage/db.ts` 为 1,113 行 |
| 生产依赖审计 | `pnpm audit --prod` | 6 high、12 moderate、2 low；主要来自 Demo Next.js 与 MCP SDK/Hono 路径 |
| npm 可用性 | `npm view @bynlk/codeomnivis@0.0.1 version --registry=https://registry.npmjs.org` | 官方注册表 404 |
| 文档同步 | 架构、REST、README、CONTRIBUTING、cal.com 文档交叉检查 | 存在旧节点模型、旧 REST、AI 501 旧说明、错误包过滤器和占位验证 |

## 安全基线与局限

有界本地复核确认：非 loopback 只保护 mutating endpoint；读取 API 暴露图和绝对路径；AI 路由没有复用 access guard；DNS 检查与实际 fetch 之间存在重新解析窗口；AI fetch 缺少 timeout、速率和并发限制。

同时已有的有效控制包括：默认 loopback 绑定、timing-safe token 比较、WebSocket Origin guard、symlink-aware 路径边界以及业务代码无 shell 执行。

此前 Codex Deep Security Scan 因当前会话可用 worker 数低于所需并发而按用户要求取消。因此这里不是穷尽式安全扫描结论；最终评分必须明确保留这一局限，除非后续完成等价或更强的验证。
