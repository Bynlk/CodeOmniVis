# 计划修改历史

> 记录所有对 development-plan.md 的修改

| 日期 | 修改内容 | 原因 | 修改人 |
|------|---------|------|--------|
| 2026-06-06 | 初始版本创建 | 项目启动 | AI |
| 2026-07-13 | 补充双应用仓库自动探测与扫描 | 真实项目验收发现 frontend/ + backend/ 结构会被识别为 0 文件，导致 Web 工作台空白 | Codex |
| 2026-07-13 | 统一首次分析与 Refresh 的目录、路径和跨层解析语义 | 真实项目交叉验证发现 Refresh 会清空图、软链接重复解析、绝对路径污染模块层级以及相对路径导致 service 链路断开 | Codex |
| 2026-07-13 | 修正 Architecture Focus 切换与 Overview 搜索的数据流 | 逐组件回归发现切换视图后残留无焦点 Focus，且默认 Overview 只搜索聚合模块而无法找到真实节点 | Codex |
| 2026-07-13 | 补齐新版工作台的中英文国际化覆盖 | 语言切换实测发现新版 Workbench 组件硬编码英文，导致搜索与设置已切换但视图导航、画布工具栏、状态栏和空状态仍显示英文 | Codex |
| 2026-07-13 | 记录前端与完整 serve 链路交叉验证结果 | 实测发现 pnpm/Turborepo packages 未进入 serve 扫描、官方 demo 缺少 calls_api/calls_service/queries_db、空或失败分析仍显示 fresh/无问题，以及开发启动命令与 WebSocket Origin 配置不一致 | Codex |
| 2026-07-13 | 修复 workspace 扫描、空分析误报与首次分析 freshness | 统一 Analyzer 文件收集和 CLI/Server 分析入口；真实仓库验证扫描 171 文件并生成 68 节点/53 边/0 悬空边，状态为 fresh；Analyzer 211、CLI 35、Server 66 项测试通过，typecheck/lint/强制无缓存 build 通过 | Codex |
| 2026-07-13 | 修复跨层作用域串线与工作台状态误报 | tRPC router identity、handler/service/DB 解析改为按真实函数作用域追踪；修复多方法路由共享行号导致 POST 误连 GET service，并将 DB 边归属到直接调用它的 service，消除 analyze/serve 时序差异；WebSocket loopback Origin、退避重连、首次/空/失败状态、移动抽屉层级和设置路径校验完成交叉验证。官方 demo 的 analyze/serve 均为 49 节点/66 边、0 悬空端点、0 unknown 端点；UI 162、Analyzer 218、CLI 36、Server 67 项测试通过 | Codex |
| 2026-07-13 | 修正 router、鉴权作用域、页面层级与源码跳转链路 | tRPC router 容器不再生成 resolver/DB 边或一致性假问题；input/output 链式元数据、页面到组件层级和 handler 级鉴权检测已校正；新增 `GET /api/project`，Web inspector 使用绝对且编码安全的 VS Code URI，切换项目会刷新根路径缓存。官方 demo 连续 analyze/serve 均为 47 节点/59 边，6 个显式未鉴权入口，`check` 为 7 个真实未调用 procedure；604 项测试、17 项强制 typecheck/lint 与 6 项强制 build 全部通过，桌面/移动端四视图与 console 完成回归 | Codex |
| 2026-07-13 | 补齐工作台键盘语义与浏览器降级边界 | 新 Workbench 恢复“跳转到主内容”；节点检查器 aria-label 完成中英文覆盖；Settings 与 Command Palette 共用焦点陷阱，验证初始焦点、Tab 循环、Escape 和焦点归还；HTTPS 页面自动使用 `wss://`；禁用或超额的 localStorage 不再导致 i18n 初始化白屏或切换语言报错。最终整仓 613 项测试、18 项强制 typecheck/lint/build 任务通过，浏览器 console 仍为 0 warning/error | Codex |
| 2026-07-13 | 修复分析失败契约与跨视图缓存漂移 | `POST /api/analyze` 失败改为标准 `ANALYSIS_FAILED` 响应，统一 API client 会保留服务端错误消息；Refresh 与项目切换统一失效 graph、stats、parser errors 和 freshness，WebSocket 断开时也不会跨项目残留旧 Quality 数据。最终整仓 616 项测试和 18 项强制检查通过，真实 Refresh 完成后仍为 47 节点/59 边且 console 无告警 | Codex |
| 2026-07-13 | 统一 Web Quality 的解析输出与项目风险语义 | 新增结构化 `GET /api/graph/issues`，复用一致性、鉴权、N+1 与 RSC 检测器并逐检测器降级；Web 合并 parser errors 与 sourced issues，显示严重级别、来源、类型和源码位置，Refresh、项目切换与 WebSocket 统一失效。官方 demo 实测为 13 条问题（6 critical/security、7 warning/consistency），刷新后保持 47 节点/59 边且 0 图噪声；整仓 631 项测试、11 项强制 typecheck、6 项 lint 与 6 项强制 build 通过，桌面/390px 窄屏中英文回归及 console 0 warning/error | Codex |
| 2026-07-13 | 修复运行时项目切换事务与 Quality 描述国际化 | loopback 绝对路径切换会为目标根重新执行 CLI 完整 metadata 探测，成功后才发布新根；目标探测或分析失败会恢复旧 root、metadata、graph、parse errors、freshness 与 watcher，并返回不泄漏内部详情的标准错误。真实 `demo → 仓库根 → 无效目录 → demo` 验证分别得到 47/59、79/64、原图无损回滚、47/59，最终仍为 13 条 Quality 与 0 图噪声。确定性检测器新增结构化 message key/params，中文 13 条说明不再混入英文，parser 原始诊断保持原文；整仓 646 项测试、11 项强制 typecheck、6 项 lint、6 项 build、390px 无横向溢出与 console 0 warning/error 全部通过 | Codex |
| 2026-07-14 | 重构 GitHub README 并完成 npm 发行前验证 | 英文 `README.md` 成为默认产品入口，新增完整中文镜像、真实 Architecture/Quality 截图和两张深色 SVG；统一公开包名为 `@bynlk/codeomnivis`，新增双语链接/结构/搜索意图契约与 tarball 隔离安装脚本。真实 `.tgz` 已从官方 registry 在全新临时目录安装，`npx --no-install codeomnivis --help`、Demo 分析、health、graph 与打包 UI 均通过；本次仅完成发布准备，未执行 `npm publish` | Codex |
| 2026-07-14 | 修正质量 90 计划中的 Demo 依赖兼容性验收 | `demo/` 是供 CodeOmniVis 静态分析的 fixture，刻意没有 `build` 脚本且不是完整可运行 Next 应用；将不存在的 `pnpm --filter demo build` 改为官方 Demo 跨层图集成测试，验证真实产品用途 | Codex |
| 2026-07-14 | 稳定 MCP CLI 生命周期回归测试 | 全套 CLI 测试并行加载时 MCP 冷启动曾在 8.15 秒越过写死的 8 秒测试上限，单测与 30 秒真实协议 E2E 均正常；统一为等待明确就绪信号的 30 秒上限，不修改生产启动逻辑 | Codex |
| 2026-07-14 | 建立覆盖率门禁并补齐解析器与入口契约 | 新增 Vitest workspace/V8 覆盖率、全局 85/85/85/80 与变更运行时代码单文件 90% 门禁，补齐 NestJS、Drizzle、TypeORM、Express、Next Pages、存储、CLI、MCP、REST 与 Tests 工作台回归；覆盖测试发现并修复 Drizzle 括号化关系、根 `pages/api` 误判、macOS realpath 越界、DataFlow handles 方向及 Node 新版 Undici 固定 DNS 连接问题。最终 827 项覆盖测试通过，全局 lines/statements 87.67%、functions 89.82%、branches 80.50%，92 个变更源文件通过 90% 门禁，全仓 build/test/typecheck/lint/diff 检查通过 | Codex |
| 2026-07-14 | 新增打包 CLI 驱动的真实浏览器 E2E | Playwright 通过临时 loopback 端口启动打包 CLI 与官方 Demo，验证 47 节点/59 边工作台、Full graph、BookingList 搜索与选中、Quality 13 findings，以及强制 503 后的受控 Canvas 错误态；浏览器 pageerror 与非预期 console error 均为 0，子进程使用 SIGTERM/SIGKILL 有界回收。E2E 连续两次通过，并经应用内浏览器复核首屏、DOM、截图和 console | Codex |
| 2026-07-14 | 将格式门禁限定为相对 `origin/master` 的新增和修改代码/配置 | 原计划 `prettier --check .` 会一次性要求机械改写 426 个与本次质量计划无关的历史文件；新增可测试的 changed-file 格式门禁，排除 Markdown、生成目录、缓存、二进制与 pnpm 自动生成的 lockfile，同时保持所有本分支运行时代码和配置必须通过 Prettier。CI 拆分为 static/test/browser/package，release 使用受保护 npm environment、OIDC provenance 与官方 registry；最终 `quality:gate` 通过 837 项测试，全局 lines/statements 88.07%、functions 90.01%、branches 80.75%，94 个变更源文件达到单文件 90%，生产依赖高危/严重漏洞为 0，Playwright 连续验证通过 | Codex |
