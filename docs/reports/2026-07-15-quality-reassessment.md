# CodeOmniVis 质量复评报告（2026-07-15）

## 结论

在沿用既有七维权重的前提下，本次全面复评得分为 **93.50/100**，较 2026-07-14 的 91.50 分提高 2.00 分。

本轮提升主要来自四类可验证变化：AI 出站地址按 IP 语义规范化、测试源码与生产图解析边界统一、双语 GitHub 入口与信任说明补强，以及 CodeQL、Dependabot、Issue Forms、CODEOWNERS 和 Node/Windows 兼容矩阵落地。项目已具备较完整的本地质量闭环和公开仓库维护基础，但仍有 22 个超过 300 行的生产文件、仅 80.98% 的分支覆盖率，以及尚未完成独立渗透测试/fuzz 的输入攻击面。

## 评估口径与排除项

- 权重保持为：代码与架构 25%、安全 15%、测试与 CI 15%、依赖 10%、文档与上手 20%、可维护性 10%、鲁棒性 5%。
- 实现基线：`c893c64cc05086e5e77bba3247e5bfef44be298a`；本轮实现快照：PR #3 的兼容性修复提交（以本报告所在 Git 提交为准）。
- 扫描范围：整个仓库的生产源码、关键测试、构建/发布脚本、GitHub 配置、公开文档、打包 CLI 和本地自分析结果。
- **不采用 Codex Security Deep Scan 的任何结果。**
- **不采用 `codex-security:security-scan` 的任何结果。**
- **不评估无障碍，也不把无障碍计入任何维度。**未评估不表示已经达到任何无障碍标准。
- 安全分数是基于代码边界、回归测试、依赖审计和配置审查的有界工程判断，不是“无漏洞”证明或第三方认证。

## 可复现证据

| 检查                                               | 结果                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm quality:gate`                                | 退出码 0；format、release 回归、lint、typecheck、build、coverage、契约、Playwright、audit、README、公共契约、packed CLI 全部通过                    |
| Vitest 覆盖运行                                    | 165 个测试文件、866 项测试通过                                                                                                                      |
| 全局覆盖率                                         | statements/lines 88.13%、functions 90.12%、branches 80.98%                                                                                          |
| 变更源码门禁                                       | 7 个变更运行时文件达到单文件覆盖率要求                                                                                                              |
| `pnpm exec turbo run lint typecheck build --force` | 19/19 任务成功，0 cached                                                                                                                            |
| Playwright                                         | 打包 CLI 驱动的真实 Chromium E2E 通过                                                                                                               |
| `pnpm audit --prod --json`                         | 286 个生产依赖节点；info/low/moderate/high/critical 均为 0                                                                                          |
| `node scripts/verifyRegistryInstall.mjs 0.1.0`     | npm 官方 registry 隔离安装和运行验证通过                                                                                                            |
| 仓库自分析                                         | 429 个文件、1,455 个节点、1,754 条边、209 个问题、0 parse error；6 个 critical 均为 `demo/` fixture 的显式未鉴权路由，0 个来自 `__tests__/fixtures` |
| 源码规模                                           | 严格按 `packages/*/src` 统计：206 个 TS/TSX 文件、25,927 行；22 个文件超过 300 行                                                                   |
| GitHub 配置                                        | 7 个 YAML 文件可解析且 `.github` 全部通过 Prettier；Issue Forms、CODEOWNERS、Dependabot、CodeQL 和兼容矩阵齐备                                      |
| Hosted 兼容性反馈                                  | Ubuntu Node 22/24 与 CodeQL 通过；Windows Node 20 暴露持久化句柄、Gradle `.bat`、测试路径/信号和 parity 超时假设，均已补充本地 RED/GREEN 与并发回归 |
| 完整提交范围                                       | `git diff --check origin/master...HEAD` 通过，tracked 工作树干净                                                                                    |

## 七维评分

| 维度               |     权重 | 得分 |      加权得分 |
| ------------------ | -------: | ---: | ------------: |
| 代码与架构质量     |      25% |   93 |         23.25 |
| 安全性             |      15% |   92 |         13.80 |
| 测试覆盖率与 CI    |      15% |   94 |         14.10 |
| 依赖管理清晰度     |      10% |   92 |          9.20 |
| 文档与上手体验     |      20% |   97 |         19.40 |
| 可维护性与可扩展性 |      10% |   90 |          9.00 |
| 鲁棒性与错误处理   |       5% |   95 |          4.75 |
| **总计**           | **100%** |      | **93.50/100** |

计算：`93×25% + 92×15% + 94×15% + 92×10% + 97×20% + 90×10% + 95×5% = 93.50`。

## 1. 代码与架构质量（93/100）

### 证据

- `analyzeProject()`、`ProjectSnapshot` 与 `snapshotDigest` 继续作为 Analyzer、CLI、REST/Web 和 MCP 的统一内核与快照契约。
- `shared ← analyzer ← server ← cli`、`analyzer ← mcp` 的依赖方向清晰；UI 通过 REST/WebSocket 消费服务端数据。
- 新增 `sourcePathPolicy.ts`，在 `GraphBuilder` 生产 parser 分发前统一跳过 `.test.`、`.spec.`、`.cy.`、`__tests__` 和 `e2e` 路径。
- 测试文件仍由同一文件收集阶段交给 test adapters，因此“生产图降噪”没有破坏 Vitest/Jest/Playwright/Cypress/JUnit/Kotest 测试智能。
- 地址规范化从服务器局部字符串规则下沉为 shared 纯函数，peer 地址比较、loopback 策略和 DNS 结果验证使用同一语义。

### 扣分

- 22 个生产文件仍超过项目自己的 300 行限制；`crossLayer.ts` 691 行、`tsrpc.ts` 660 行、`reactComponent.ts` 557 行，复杂度仍集中在 parser/resolver/server 热点。
- 静态分析依赖启发式匹配，动态导入、依赖注入、生成代码和元编程仍可能形成不完整关系。
- 兼容 facade 与当前统一入口并存，尚未建立明确的移除版本与自动依赖方向检查。

## 2. 安全性（92/100）

### 证据

- 默认 loopback 绑定、非 loopback REST/AI/WebSocket 鉴权、HttpOnly/SameSite session、timing-safe token、WebSocket Origin 和 realpath/symlink 项目边界继续受测试保护。
- AI 出站策略现在规范化 IPv4、原生 IPv6 和 IPv4-mapped IPv6；映射/压缩形式的 loopback、RFC1918、链路本地、metadata 以及展开形式的 `::1`/`::` 均被一致处理。
- 实际 socket peer 与已验证 DNS 地址按规范地址值比较，避免十六进制、点分和压缩文本表示造成误拒绝或绕过。
- 出站请求保留固定目标、禁止重定向、超时、请求/响应大小、并发和速率上限。
- 生产依赖审计为 0/0/0/0；npm `0.1.0` 继续使用 OIDC Trusted Publisher 与 provenance，未引入长期发布 token。
- 新增私密漏洞报告入口、CODEOWNERS 与 least-privilege CodeQL workflow。

### 扣分

- 本轮明确没有 Codex Security Deep Scan 或 `codex-security:security-scan` 结果，也没有独立渗透测试或第三方审计。
- 解析不可信源码、XML、WASM、路径和大文件仍是高复杂度输入面；当前测试不能替代系统性 fuzz。
- 私密漏洞报告、CodeQL 和 hosted compatibility 需要在 GitHub 公开状态中持续保持可用和绿色。

## 3. 测试覆盖率与 CI（94/100）

### 证据

- 165 个文件、866 项测试覆盖 parser、resolver、storage、CLI、MCP、REST、WebSocket、UI、错误路径、生命周期与真实协议。
- 新增回归测试经过可观察的 RED/GREEN：映射 IPv6、部分压缩映射地址、语义 peer 相等、展开原生 IPv6 loopback/unspecified、生产 parser 不分发测试 fixture、Windows 可写持久化句柄、安全的 Gradle batch 执行计划，以及平台原生的路径/进程退出契约。
- 全局覆盖率稳定高于 85/85/85/80 门禁，变更运行时代码另受单文件覆盖率门禁。
- Playwright 从打包 CLI 启动真实服务并验证工作台与受控错误态；跨入口契约验证 TypeScript/Kotlin 快照和测试智能一致。
- CI 保留原 Ubuntu Node 20 四大 job，并新增 Ubuntu Node 22、Node 24 与 Windows Node 20 兼容矩阵。
- 新增每周 CodeQL 和依赖更新自动化，不改变现有 release 工作流。

### 扣分

- branch coverage 80.98% 仅略高于 80% 门禁，明显落后于 statements/lines/functions。
- Windows 和新增 Node 版本此前没有持续历史数据；本轮必须以 PR hosted checks 全绿作为合并条件。
- 缺少 parser/path/XML/WASM 的 property-based 和 fuzz 测试，也没有长期性能趋势基线服务。

## 4. 依赖管理清晰度（92/100）

### 证据

- pnpm workspace、冻结 lockfile、Turborepo 依赖图和单一 `packageManager` 版本源保持一致。
- 286 个生产依赖节点没有已知 advisory；audit、构建与 packed CLI 安装进入质量门禁。
- Dependabot 对 pnpm workspace 的 minor/patch 更新分组并限制开放 PR 数，对 GitHub Actions 使用月度分组更新。
- 公开 CLI 继续固定 npm 官方 registry，隔离安装会验证 help、真实分析、health、非空 graph 和打包 UI。

### 扣分

- 多数依赖仍使用 caret 范围，parser、网络和构建工具升级需要依赖 lockfile 与回归门禁控制风险。
- 内部包为 `0.0.1`、公开 CLI 为 `0.1.0`；如果未来独立发布内部包，需要正式版本策略。
- 根项目与公开 CLI 的 Node engine 表述仍可进一步统一。

## 5. 文档与上手体验（97/100）

### 证据

- 英文和中文 README 都保留 4 张真实产品/架构视觉资产，没有用生成图替换真实工作台证据。
- 增加 npm version/download badges、明确 Quick Start、首分钟结果表和 5 项等价 FAQ。
- FAQ 明确 local-first、源码不上传/不修改、静态分析置信度、MCP 行为和 PolyForm Noncommercial 商业许可边界。
- `SECURITY.md` 已改为支持 `0.1.x`，区分本地核心分析与用户主动配置的 AI 出站。
- 当前 License 描述已纠正；旧工程计划与状态报告带有醒目的历史快照警告。
- README、FAQ、npm 链接、视觉资产和双语结构由可执行契约保护，Markdown 进入变更格式门禁。

### 扣分

- 深层设计、计划和阶段报告数量较多，Current / Reference / Archived 的导航仍可更明确。
- Windows、远程绑定、大仓库调优和常见安装故障尚未集中成独立 Troubleshooting 页面。
- `AGENTS.md` 引用的 `.Codex/skills/*.md` 在当前 checkout 不存在，属于需要清理或恢复的文档漂移。

## 6. 可维护性与可扩展性（90/100）

### 证据

- parser/test adapter 注册表、统一接口、稳定节点 ID、confidence、schemaVersion 与 snapshotDigest 提供了清晰扩展点。
- 生产/test 路径判断从各 parser 的分散规则收敛到一个无状态策略，减少 fixture 漏入生产图的重复防线。
- GitHub Issue Forms 要求最小复现、版本、OS、Node、项目栈、日志脱敏和明确 scope，有助于把外部反馈转化为可测试 fixture。
- CODEOWNERS、分组依赖更新和 PR 模板为发布/安全/配置变更建立了维护入口。

### 扣分

- 22 个超长文件仍是最主要的长期维护债务，因此本维度只从 89 提升到 90。
- 新框架仍可能同时触及 classifier、parser、resolver、metadata、测试和 UI 投影，缺少自动生成的 parser 契约脚手架。
- 尚无自动依赖方向、复杂度和文件行数趋势门禁。

## 7. 鲁棒性与错误处理（95/100）

### 证据

- parser 继续遵守“降级而非崩溃”，单文件错误进入结构化诊断；storage 事务、配置错误和安全拒绝仍明确失败。
- 生产 parser 的 test-path 跳过是无异常的 pre-dispatch 策略，不影响 test adapters 的独立降级与发现。
- IPv6 文本形式不再决定安全结论，DNS 结果与 socket peer 使用同一规范化语义。
- 项目切换回滚、空分析、数据库/进程关闭、WebSocket 重连、localStorage 失败、API 503、registry 传播延迟和 bounded test-run 均有回归覆盖。
- 自分析在 429 个文件上得到 0 parse error，fixture 不再制造生产 critical。

### 扣分

- 尚无系统化 fault injection 覆盖磁盘写满、数据库损坏、网络半开、WASM 初始化失败和极端文件树组合。
- 启发式 parser 的“部分成功”仍要求用户结合 warning 与 confidence 判断完整性。

## 相比 2026-07-14 的变化

| 维度       | 旧分 | 新分 | 变化原因                                                 |
| ---------- | ---: | ---: | -------------------------------------------------------- |
| 代码与架构 |   92 |   93 | 统一生产/test 分发边界与共享 IP 语义                     |
| 安全       |   89 |   92 | 关闭映射/非规范 IPv6 边界，增加 CodeQL 与私密报告入口    |
| 测试与 CI  |   92 |   94 | 24 项新增回归、Node 22/24 与 Windows 矩阵、CodeQL        |
| 依赖       |   90 |   92 | 分组 Dependabot 与 0/0/0/0 审计闭环                      |
| 文档       |   94 |   97 | 双语 Quick Start、首分钟结果、FAQ、npm badges 与信任说明 |
| 可维护性   |   89 |   90 | 中央路径策略与仓库维护模板；超长文件债务仍在             |
| 鲁棒性     |   93 |   95 | 地址规范化、fixture 降噪和新边界回归                     |

## 主要剩余风险与下一步

1. 将 branch coverage 提升到至少 85%，优先覆盖 parser 异常分支、远程鉴权拒绝、事务回滚和关闭竞态。
2. 分阶段拆分 22 个超 300 行文件，先处理 `crossLayer.ts`、`tsrpc.ts`、`reactComponent.ts`、`apiCalls.ts`、`nextjsApp.ts` 和 `dataFlowTracer.ts`。
3. 对路径、XML、TypeScript/Kotlin parser、WASM 和超大文件增加 property-based/fuzz 测试，并设置 CPU、文件大小和总扫描预算。
4. 安排独立安全评审或渗透测试，重点覆盖远程绑定、session/WS、项目根切换和可选 AI 出站。
5. 将文档进一步分为 Current / Reference / Archived，并修复 `AGENTS.md` 中不存在的本地 Skill 引用。

## 评估限制

- 本轮进行了仓库级扫描、关键实现逐项审查和完整门禁，但没有逐行人工审计全部 25,927 行生产包源码。
- 没有使用两类 Codex Security 扫描结果，也没有外部安全认证；92 分安全结论只能解释为“现有工程控制较强且证据完整”。
- 本地运行环境为 macOS；新增 Linux/Windows/Node 兼容性最终以 GitHub hosted checks 为准。
- cal.com 大项目证据沿用固定 revision 的既有可复现结果，本轮没有重新扫描上游后续版本。
- 无障碍完全排除在评分之外；本报告不对其状态作任何合格声明。
- 该分数是基于既定权重、可复现证据和专业判断的内部质量评级，不等同于第三方认证。
