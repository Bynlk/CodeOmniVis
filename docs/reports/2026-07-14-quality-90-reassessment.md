# CodeOmniVis 质量 90 复评报告

## 结论

在保持原评估权重不变的前提下，本次复评得分为 **91.50/100**。所有维度均不低于 85 分，项目已经从“功能可用但质量闭环不足”进入“具备可重复质量门禁、公开发布链路和跨入口一致性证明”的阶段。

原权重与项目当前风险结构基本匹配：CodeOmniVis 是一个会读取本地源码、启动 Web 服务并向 npm 分发的开发工具，代码架构、文档上手、安全和测试都直接影响用户信任，因此不建议为了提高总分而调整权重。

## 评估范围与证据

- 实现快照：`73d022d138a5e1ee0c1ca77fec90a9d352279eca`（`master`）。
- 公开版本：`@bynlk/codeomnivis@0.1.0`，npm `latest`，发布来源标签 `v0.1.0` / `39633ef4c3ecca72aae8e7ecf9203e19942eb6e7`。
- 生产源码规模：215 个 TypeScript/TSX 文件，约 25,937 行；22 个文件超过 300 行。
- 完整质量门禁：`pnpm quality:gate` 本地退出码 0。
- 测试：163 个测试文件、842 项测试全部通过；跨入口契约另有 2 项通过；Playwright 打包 CLI 浏览器 E2E 通过。
- 覆盖率：statements 88.11%、branches 80.86%、functions 90.06%、lines 88.11%。
- 静态检查：format、lint、typecheck、build 全部通过。
- 生产依赖审计：`critical=0, high=0, moderate=0, low=0`。
- 发布验证：npm 官方 registry 返回 `0.1.0` 和 SLSA provenance attestation；`node scripts/verifyRegistryInstall.mjs 0.1.0` 在隔离临时目录验证安装、CLI 帮助、真实分析、health、非空 graph 与打包 UI，退出码 0。
- CI：Release 完整质量门禁与 OIDC provenance 发布成功；提交 `73d022d` 的常规 CI run `29344615306` 中 Static quality、Tests and coverage、Browser E2E、Package and security 四个并行 job 全部成功。
- 真实项目证据：固定 cal.com revision 扫描 2,243 个文件，生成 3,223 个节点、4,413 条边、0 parse error，耗时 50.15 秒；千文件测试发现基准约 1.2 秒。

## 1. 各维度评估

### 1.1 代码与架构质量（25%）

**得分：92/100；加权得分：23.00**

#### 已确认优势

- `shared ← analyzer ← server ← cli`、`analyzer ← mcp` 的包边界清晰，UI 只通过 REST/WebSocket 消费服务端协议。
- `analyzeProject()` 已成为统一分析内核，CLI、REST/Web 和 MCP 通过同一 `ProjectSnapshot` 投影结果；跨入口测试比较摘要、节点、边、问题与测试智能结果。
- 项目探测、文件收集、解析器注册、跨层连线、图校验与事务写入形成可追踪流水线。
- 存储层已从单一超大模块拆出 database、node/edge/error/graph/stats repository、metadata guard 与 persistence 职责；旧入口保留为兼容 facade。
- 公开 CLI、REST 与 MCP 名称由可执行契约锁定，文档也从实际注册表提取验证，降低实现与说明漂移。

#### 扣分项

- 仍有 22 个生产文件超过项目规定的 300 行；`crossLayer.ts` 691 行、`tsrpc.ts` 660 行、`reactComponent.ts` 557 行，复杂解析和连线规则仍集中。
- 解析器本质上包含较多启发式规则；框架版本、链式 API、动态路由和跨文件别名仍可能让单文件职责逐渐膨胀。
- 兼容包装器和公开契约层是必要的迁移成本，但短期内增加了调用路径数量。

#### 具体改进建议

1. 按“候选提取 → 作用域归属 → 边生成 → 置信度判定”继续拆分 `crossLayer.ts`、`tsrpc.ts`、`reactComponent.ts`，先将所有生产组件控制到 450 行以内，再逐步恢复 300 行规则。
2. 引入依赖方向自动检查（例如 dependency-cruiser 或自有 AST 规则），在 CI 中禁止 parser 互相依赖、禁止 parser 访问 storage、禁止 UI 引用 analyzer。
3. 为 `ProjectSnapshot.schemaVersion`、parser/test-adapter registry 和兼容 facade 建立 ADR 与弃用窗口，防止下一轮功能扩展重新形成双路径。

### 1.2 安全性（15%）

**得分：89/100；加权得分：13.35**

#### 已确认优势

- 默认仅绑定 loopback；非 loopback 数据读取、写入、AI 和 WebSocket 使用统一 bearer/session 策略。
- session 使用高熵随机值、绝对过期、容量上限、HttpOnly、SameSite=Strict，并对 token 做 timing-safe 比较。
- WebSocket 同时校验 Origin 与访问身份；路径切换使用 realpath/symlink 边界检查并支持失败回滚。
- AI 出站请求具备地址验证、固定连接目标、重定向拒绝、超时、响应大小、并发和速率限制，降低 SSRF、DNS rebinding 与资源耗尽风险。
- 安全响应头、受控错误输出和敏感字段清洗已有测试；当前生产依赖审计为 0/0/0/0。
- npm 正式版本通过 GitHub OIDC Trusted Publisher 发布并带 provenance，不依赖长期 npm 发布令牌。

#### 扣分项

- 先前 Codex Deep Security Scan 已按用户要求取消，本次没有可替代的穷尽式多轮扫描结果。
- 尚未进行独立渗透测试、第三方代码审计或公开漏洞赏金验证。
- 解析不可信仓库、加载 WASM、处理 XML/源码以及可选 AI 出站访问仍属于高输入复杂度攻击面；现有单元/集成测试不能等同于对抗性验证。

#### 具体改进建议

1. 在下一个次版本前执行一次独立安全评审，重点覆盖远程绑定、session/WS、项目根切换、AI 出站策略、XML/WASM 和压缩/超大文件输入。
2. 为路径规范化、XML、Kotlin/TypeScript parser 和 HTTP 协议边界增加 property-based/fuzz 测试，并设置 CPU、文件大小和总扫描预算。
3. 在 CI 增加 CodeQL、SBOM 生成与 artifact attestation 校验；Dependabot/Renovate 更新必须经过现有 package smoke test。
4. 发布安全威胁模型与 SECURITY.md 响应流程，明确 loopback 信任边界、远程暴露方式和漏洞报告渠道。

### 1.3 测试覆盖率与 CI（15%）

**得分：92/100；加权得分：13.80**

#### 已确认优势

- 842 项测试覆盖 parser、resolver、storage、CLI、MCP、REST、WebSocket、UI、错误路径和真实协议生命周期。
- 全局覆盖率门禁为 lines/statements/functions 85%、branches 80%；质量工程新增和修改的运行时代码另有单文件 90% 门禁。
- CLI、REST、MCP、analyzer 对同一 TypeScript/Kotlin fixture 的快照与测试智能结果进行一致性验证。
- Playwright 从打包后的 CLI 启动真实服务，验证工作台、搜索、Quality、错误态、浏览器 pageerror/console 和子进程回收。
- CI 已拆分为四个并行 job，并上传 coverage 与失败浏览器 trace；Release 会重新执行完整 `quality:gate` 后才发布。
- registry 传播延迟已通过先失败后通过的 3 项回归测试覆盖，常规 CI 和 Release quality gate 都执行该测试。

#### 扣分项

- branch coverage 为 80.86%，刚超过门禁，明显低于 statements/lines/functions。
- CI 主要覆盖 Ubuntu + Node 20，Release 覆盖 Ubuntu + Node 24；尚无 Windows、不同文件系统大小写语义或 Node 22 的持续矩阵。
- `v0.1.0` 首次正式 Release 在发布成功后立即查询 registry，因短暂 404 使 post-publish job 标红；产品已成功发布并经隔离验证，后续提交已加入有界重试，但该次历史 run 仍保留失败状态。

#### 具体改进建议

1. 下一目标将 branch coverage 提升到 85%，优先补齐解析器异常分支、远程鉴权拒绝、事务回滚和进程关闭竞态。
2. 增加 Node 20/22/24 最小矩阵，并对 Windows 路径、盘符、大小写与 symlink 行为建立每周或 release-candidate job。
3. 给 npm 发布后验证增加可观测的重试日志，并在后续版本验证 provenance subject 与下载 tarball integrity，而不只验证版本可见和运行结果。

### 1.4 依赖管理清晰度（10%）

**得分：90/100；加权得分：9.00**

#### 已确认优势

- pnpm workspace、单一 `packageManager` 版本源、冻结 lockfile 和 Turborepo 依赖图已统一。
- 每个包声明明确的 workspace 依赖、构建入口、类型入口和 `files` 白名单；公开 CLI 的 `publishConfig.registry` 固定为 npm 官方 registry。
- production audit 和 packed-package 隔离安装进入 CI；当前 286 个生产依赖节点无已知 low/moderate/high/critical advisory。
- tarball 仅 20 个条目，约 680 KB 压缩、5.3 MB 解压，不含 source map、本机路径或源码目录。

#### 扣分项

- 多数依赖使用宽松 caret 范围，CLI 为单包分发而重复声明 analyzer/server 运行时依赖，升级影响面较大。
- 内部包版本仍为 `0.0.1`，公开 CLI 为 `0.1.0`；虽然 workspace 构建可用，但长期发布多个内部包时需要明确版本策略。
- 根项目 Node 要求 `>=18.0.0`，公开 CLI 为 `>=18.17.0`，开发与用户运行时下限仍有轻微表达差异。

#### 具体改进建议

1. 使用 Renovate/Dependabot 分组更新 parser、UI、构建工具和安全敏感网络依赖，并为关键工具链设置审查后的上限或 overrides。
2. 明确内部包“不独立发布”或采用 Changesets 统一版本；若继续打包进 CLI，则移除容易误解的公开 publish metadata。
3. 对齐根与 CLI Node engine，并在 README、CI 矩阵和 package metadata 中只维护一个运行时支持策略。

### 1.5 文档与上手体验（20%）

**得分：94/100；加权得分：18.80**

#### 已确认优势

- 英文 README 是 GitHub/npm 默认入口，中文镜像完整；包含真实 Architecture/Quality 截图、产品定位、支持范围、CLI、MCP、REST、限制、开发与路线图。
- `npx @bynlk/codeomnivis serve` 已能从 npm `latest` 实际安装并运行，核心 60 秒体验不再依赖本地仓库。
- README、CLI README、CONTRIBUTING、架构、数据模型、解析流水线、REST/MCP 文档已围绕同一公开契约同步。
- 文档中的 CLI、REST、MCP 与包过滤器由脚本从实现提取交叉验证，能阻止常见的过期示例回归。
- `docs/README.md`、设计、计划、状态报告、变更记录和真实项目验证证据形成了较完整的项目知识路径。

#### 扣分项

- 深层设计与历史计划很多，新贡献者仍需判断哪些是当前契约、哪些是归档背景。
- 公开文档对高级故障排查、Windows 差异、远程绑定安全配置和大仓库调优仍可更集中。

#### 具体改进建议

1. 给 `docs/README.md` 增加 Current / Reference / Archived 明确分区，并在历史计划顶部标记 superseded-by 链接。
2. 新增一页 Troubleshooting，覆盖私有 npm registry 覆盖、端口冲突、WASM、Node 版本、空图、远程访问认证和大仓库性能。
3. 为每个正式版本生成简短 release notes 和迁移说明，并让 README 的 npm 版本、命令和支持矩阵继续受自动契约保护。

### 1.6 可维护性与可扩展性（10%）

**得分：89/100；加权得分：8.90**

#### 已确认优势

- parser 与 test adapter 使用注册表和统一接口，TypeScript/Kotlin 框架可在不改消费端的情况下扩展。
- 稳定节点 ID、confidence、schemaVersion、snapshotDigest 和结构化 metadata 为新框架、新视图和 MCP 工具提供了可演进边界。
- storage repository、共享访问策略、统一错误协议和文档契约减少了跨包复制。
- 兼容 facade 使旧 CLI/REST/MCP 表面保持稳定，同时允许内部逐步迁移。

#### 扣分项

- 22 个超 300 行文件仍违反项目自己的单一职责目标，且集中在最易增长的 parser/resolver/server 位置。
- 框架启发式与跨层关联规则对 fixture 质量依赖较高；新增一个框架可能需要同时理解 classifier、parser、resolver、metadata 和 UI 投影。
- 兼容 facade 尚未设定自动告警或删除版本，存在长期保留双入口的风险。

#### 具体改进建议

1. 提供正式 parser/test-adapter 开发模板、契约测试生成器和最小 fixture 套件，将“正常/异常/边界/性能/一致性”变成脚手架默认项。
2. 设立源码复杂度预算：文件行数、圈复杂度、跨包 import 和 parser 注册数量在 PR 中生成趋势报告，而不是一次性大重构。
3. 给兼容 facade 增加 deprecated 注释、调用计数测试和删除目标版本，确保统一内核不会再次分叉。

### 1.7 鲁棒性与错误处理（5%）

**得分：93/100；加权得分：4.65**

#### 已确认优势

- parser 遵守“降级而非崩溃”，单文件/单检测器错误进入结构化 warning，不阻断其余图谱。
- 图写入事务化，边端点、metadata 和写入报告可验证；失败会回滚并保留上一份成功快照。
- 项目切换、刷新、WebSocket 断开、localStorage 禁用、API 503、空分析、MCP/CLI 进程生命周期和信号回收都有回归测试。
- 出站请求、分析启动、浏览器 E2E 子进程和 registry 可见性均有有界 timeout/retry，不会无限等待。
- CLI 人类日志、机器 JSON 与 MCP stdio 分离，协议错误和退出码更可预测。

#### 扣分项

- 启发式 parser 对新语法可能返回“部分成功”，用户仍需结合 parse warning 与 confidence 判断完整性。
- 尚无系统性 chaos/fault-injection 套件验证磁盘写满、数据库损坏、超大目录、网络半开和进程异常终止组合。

#### 具体改进建议

1. 增加故障注入测试：原子写失败、SQLite 损坏、watcher 关闭超时、网络半开、WASM 初始化失败和超大/二进制文件。
2. 在 CLI/Web/MCP 统一展示 `partial`、warning 数、拒绝边数和 snapshot freshness，避免用户把降级结果误认为完整结果。
3. 对每类可恢复错误维护稳定 error code、用户建议和遥测友好的计数，但默认不上传源码或路径。

## 2. 加权总分

| 维度               |     权重 | 得分 |      加权得分 |
| ------------------ | -------: | ---: | ------------: |
| 代码与架构质量     |      25% |   92 |         23.00 |
| 安全性             |      15% |   89 |         13.35 |
| 测试覆盖率与 CI    |      15% |   92 |         13.80 |
| 依赖管理清晰度     |      10% |   90 |          9.00 |
| 文档与上手体验     |      20% |   94 |         18.80 |
| 可维护性与可扩展性 |      10% |   89 |          8.90 |
| 鲁棒性与错误处理   |       5% |   93 |          4.65 |
| **总计**           | **100%** |      | **91.50/100** |

计算：`92×25% + 89×15% + 92×15% + 90×10% + 94×20% + 89×10% + 93×5% = 91.50`。

## 3. 本次评估的局限

- 本次读取了目录、关键实现、配置、测试、CI、文档与发布产物，并实际运行完整门禁和 registry smoke test，但没有逐行人工审计全部约 25,937 行生产代码。
- 先前 Codex Deep Security Scan 已按用户明确要求取消，本次没有恢复；没有独立渗透测试或第三方安全认证，因此 89 分安全结论是有界工程评审，不是“没有漏洞”的保证。
- branch coverage 只有 80.86%；部分历史 parser/resolver 文件的分支覆盖与启发式语法覆盖仍不均衡。
- 本地验证在 macOS 完成，GitHub CI 主要为 Ubuntu + Node 20，Release 为 Ubuntu + Node 24；没有持续 Windows 矩阵。
- cal.com 结果基于固定 revision，不代表上游后续版本；未对所有支持框架的大型真实仓库做同等规模复测。
- `v0.1.0` 的发布与 provenance 已成功，但首次 Release run 的即时 registry 查询遇到传播延迟而标红；后续隔离验证已通过，`73d022d` 已加入有界重试，历史 run 状态本身不会被改写。
- 按用户要求，本次不评估无障碍；这不表示当前产品已达到任何无障碍标准。
- 分数是基于既定权重、可复现证据和专业判断的内部质量评级，不等同于外部认证。
