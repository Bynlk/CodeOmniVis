# CodeOmniVis 90 分质量工程设计

**状态：** 已批准，进入实施

**日期：** 2026-07-14

**目标版本：** 首个可从 npm 官方注册表稳定安装并验证的公开版本

## 1. 背景与结论

CodeOmniVis 已完成 Phase 1–7，具备 TypeScript/Kotlin 解析、跨层连线、Web 工作台、CLI 与 MCP 等主要能力。当前主要问题不是继续堆叠功能，而是同一项目在不同入口下可能走不同分析路径，发布、鉴权、测试、文档和错误语义尚未形成可证明的一致闭环。

本轮采用“一个分析内核、一个快照契约、三个消费端”的结构：CLI 面向开发者与脚本，Web 面向用户，MCP 面向 AI 助手。三者可以采用不同交互方式，但必须消费相同的 `ProjectSnapshot`，并能通过快照摘要证明结果一致。

本轮完成标准不是“代码大致改善”，而是原权重下重新评估达到至少 90/100，且每个维度至少 85 分、无未关闭 P0/P1 问题、真实 npm 发布与干净环境 `npx` 验证通过。

## 2. 质量目标与评分治理

沿用原评估权重，不为了提高总分而调整权重：

| 维度 | 权重 | 目标分 |
|---|---:|---:|
| 代码与架构质量 | 25% | 92 |
| 安全性 | 15% | 90 |
| 测试覆盖率与 CI | 15% | 92 |
| 依赖管理清晰度 | 10% | 88 |
| 文档与上手体验 | 20% | 92 |
| 可维护性与可扩展性 | 10% | 88 |
| 鲁棒性与错误处理 | 5% | 92 |

加权目标为 90.9。发布门禁同时要求：

- 加权总分不低于 90；
- 任一维度不低于 85；
- 无已知 P0/P1 缺陷；
- 所有公开契约测试、质量门禁和发布验证通过；
- 评分证据记录实际命令、提交哈希和结果，不使用主观“已完成”代替验证。

## 3. 范围

### 3.1 包含

- 修复公开 `mcp` 命令生命周期；
- 修复 CI 分支与发布流程；
- 收敛项目探测、扫描、解析、连线、校验和落库为一个分析内核；
- 引入带版本、来源、新鲜度和摘要的 `ProjectSnapshot`；
- 拆分超大存储模块，提供事务化写入和结构化写入报告；
- 强化非 loopback 场景的 REST、WebSocket 与 AI 路由鉴权；
- 修复高风险依赖并建立持续审计策略；
- 建立覆盖率、协议 E2E、浏览器 E2E、解析器契约和跨入口一致性测试；
- 自动识别 TypeScript 与 Kotlin 测试套件、用例、fixture 及其覆盖关系；
- 同步 README、架构、REST、MCP、贡献和发布文档；
- 真实发布到 npm，并从干净注册表环境执行 `npx` 验证。

### 3.2 不包含

- 默认执行被分析项目的测试代码；
- 将 CodeOmniVis 变成通用覆盖率平台或 CI 托管服务；
- 破坏性重命名公开 CLI 命令、REST 路径或 MCP 工具名；
- 为追求解析深度而牺牲 60 秒内看到可用架构图的核心体验；
- 本轮无障碍专项评分。

## 4. 基线与已确认问题

基线提交为 `fd86f489bf917d853bda95c7c06515b6167aaa3d`，分支为 `master`，远端跟踪 `origin/master`。基线复核结果：649 个测试通过，18 个非缓存 build/typecheck/lint 任务通过，README 校验和隔离 tarball 校验通过；但当前综合评分仅 68.75。

主要缺口：

- `codeomnivis mcp` 动态导入模块后，MCP 模块只在直接作为进程入口时启动，CLI 显示成功后进程约 0.8 秒退出；
- CI 监听不存在的 `main`，而仓库实际默认分支为 `master`；
- `runAnalysis()` 与 `runFullAnalysis()` 分别探测和扫描项目，存在结果漂移；
- 生产源码 167 个文件、约 24,072 行，其中 22 个文件超过 300 行，`storage/db.ts` 达 1,113 行；
- 覆盖率命令缺少 `@vitest/coverage-v8`，没有真实浏览器 E2E；
- NestJS、Drizzle 缺少独立行为测试；
- 生产依赖审计存在 6 个 high、12 个 moderate、2 个 low，主要来自 Demo Next.js 与 MCP SDK/Hono 依赖链；
- npm 官方注册表尚不存在 `@bynlk/codeomnivis@0.0.1`；
- 架构、REST、AI route、贡献和 cal.com 验证文档存在过期或占位内容；
- 手工安全复核发现非 loopback 读取接口、AI 路由、DNS rebinding、AI 请求资源限制等问题。

此前深度安全扫描因可用 worker 数不足而取消。因此本设计引用的是有界本地审查结果，不将其表述为穷尽式安全证明。

## 5. 目标架构

```text
CLI / Server / MCP
        │
        ▼
detectProject() → analyzeProject()
        │
        ├── collectAnalysisFiles()
        ├── parser registry
        ├── test adapter registry
        ├── cross-layer linker
        ├── graph validator
        └── transactional storage commit
                 │
                 ▼
          ProjectSnapshot
                 │
        CLI / REST-Web / MCP
```

### 5.1 分层责任

- `shared`：稳定、可序列化的快照、节点、边、问题、错误与协议类型；
- `analyzer`：唯一的项目探测、文件收集、解析器/测试适配器编排、连线、图校验、快照生成与存储；
- `server`：会话、REST、WebSocket、静态 UI 和分析生命周期，不复制分析逻辑；
- `cli`：参数、终端输出、进程退出码和显式命令，不复制项目探测；
- `mcp`：MCP transport 与工具投影，通过显式入口启动，不复制分析逻辑；
- `ui`：只通过 server 协议读取和操作快照，不依赖 analyzer 内部实现。

### 5.2 兼容策略

公开 CLI 命令、REST 路径和 MCP 工具名保持不变。`runAnalysis()` 与 `runFullAnalysis()` 暂时保留为兼容包装器，内部都委托给 `analyzeProject()`；新代码不得直接扩展旧路径。兼容包装器在一个公开版本周期后再评估弃用。

非 loopback 环境下，过去未鉴权即可读取数据的行为不视为兼容契约，可直接安全收紧。loopback 默认仍保持零配置可信体验。

## 6. 核心契约

### 6.1 ProjectSnapshot

```typescript
export interface ProjectSnapshot {
  schemaVersion: 1
  snapshotId: string
  snapshotDigest: string
  project: {
    root: string
    fingerprint: string
    meta: ProjectMeta
  }
  graph: OmniGraph
  issues: Issue[]
  parseErrors: SerializableParseError[]
  stats: AnalysisStats
  freshness: FreshnessStatus
  provenance: {
    generatedAt: number
    analyzerVersion: string
    filesScanned: number
    sourceDigest: string
  }
}
```

`snapshotDigest` 由稳定序列化后的公开快照内容计算，排除绝对项目根路径、生成时间和入口特有字段。相同源码和配置经 CLI、REST、MCP 分析必须得到相同摘要。`snapshotId` 标识一次成功提交，可包含时间或随机成分，不承担一致性比较职责。

`project.fingerprint` 由规范化项目根、配置和锁文件身份生成，用于区分项目；`provenance.sourceDigest` 由实际扫描文件的规范路径与内容摘要生成，用于判断输入是否变化。

### 6.2 分析入口

```typescript
export interface AnalyzeProjectOptions {
  projectRoot: string
  dbPath?: string
  db?: AnalysisStore
  config?: CodeOmniVisConfig
  signal?: AbortSignal
  onProgress?: (event: AnalysisProgressEvent) => void
}

export interface AnalyzeProjectResult {
  snapshot: ProjectSnapshot
  writeReport: WriteReport
}

export async function analyzeProject(
  options: AnalyzeProjectOptions,
): Promise<AnalyzeProjectResult>
```

项目探测由 analyzer 的 `detectProject()` 唯一实现。CLI 的 `autoDetect` 迁移为参数/配置适配器或兼容再导出，不再维护第二套框架识别逻辑。

### 6.3 写入语义

```typescript
export interface WriteReport {
  committed: boolean
  nodes: { attempted: number; written: number; rejected: number }
  edges: { attempted: number; written: number; rejected: number }
  errors: { written: number }
  rejectedEdges: Array<{
    edgeId: string
    reason: 'missing_source' | 'missing_target' | 'invalid_metadata'
  }>
}
```

完整分析写入一个事务：先写节点，再验证并写边，最后写错误、统计和快照元数据。发生存储级错误时整体回滚，旧快照继续可读；解析器级错误仍按“降级而非崩溃”进入 `parseErrors`。部分边被拒绝时不得报告为完整成功，`WriteReport` 必须反映数量与原因。

### 6.4 错误分类

- `configuration`：项目根、配置或参数无效，命令返回非零；
- `unsupported_input`：没有可识别源码或节点，给出可操作建议；
- `parser_warning`：单文件或单框架解析失败，保留其余结果；
- `storage_failure`：事务回滚，保留旧快照；
- `protocol_failure`：REST/MCP/WS 以统一错误码投影；
- `security_rejection`：鉴权、Origin、路径或远程请求策略拒绝，不泄漏内部路径和凭据。

边界错误必须可序列化；`Error` 对象只在进程内保留，输出时转换为受控字段。

## 7. 三个消费端的一致性

### 7.1 CLI

- `analyze` 输出快照或摘要，脚本模式使用稳定 JSON；
- `check` 从同一快照读取问题并以严重级别决定退出码；
- `serve` 调用 server，server 再调用统一内核；
- `mcp` 调用 `startMcpServer(options)` 并保持 stdio transport 生命周期；
- 人类可读日志写 stderr，机器 JSON 写 stdout，避免协议污染。

### 7.2 Web

- 现有 REST 路径保持不变，内部响应统一来自当前已提交快照；
- UI 可展示架构、质量、测试等多个视图，并在大画布中渐进展开；
- 分析中继续展示上一份成功快照，并通过 freshness 表示 `analyzing`/`stale`；
- WebSocket 只通知快照状态与标识，客户端按需重新取数，不传输相互矛盾的临时图。

### 7.3 MCP

- 保留现有工具名；
- 显式导出 `startMcpServer(options)` 和可测试的 server factory；
- 工具从统一快照查询，不重新扫描项目；
- MCP 返回包含 `snapshotId` 与 `snapshotDigest`，便于 AI 判断上下文是否过期；
- stdio 模式禁止向 stdout 写普通日志。

### 7.4 一致性证明

固定同一 fixture，分别通过 analyzer API、CLI JSON、REST 和 MCP 获取快照投影。测试对规范化后的 `snapshotDigest`、节点/边数量、节点/边 ID 集合与问题集合进行比较。任何入口差异都阻止发布。

## 8. 跨语言测试智能

### 8.1 目标

自动识别测试“并不难”，难点在于跨框架语义差异和从测试到生产代码的可信连线。本轮将发现与连线拆开：先可靠识别测试结构，再以 `certain`/`inferred` 标注覆盖关系，无法确认时降级为 warning 或不连边，不伪造确定性。

### 8.2 统一模型

新增节点类型：

- `test_suite`：文件、`describe`、JUnit/Kotest 容器；
- `test_case`：`it`/`test`、JUnit `@Test`、参数化测试模板、Kotest case；
- `test_fixture`：`beforeEach`/`afterEach`、fixture factory、JUnit lifecycle 与共享 fixture。

节点 ID 继续遵守 `{type}:{filePath}:{name}`。嵌套 suite/case 的 `name` 使用从文件根开始的稳定限定名，例如 `checkout > rejects expired card`，参数化运行实例不在静态阶段扩展成不稳定的多个节点。

```typescript
export interface TestSuiteMetadata {
  framework: 'vitest' | 'jest' | 'playwright' | 'cypress' | 'junit4' | 'junit5' | 'kotest'
  kind: 'file' | 'describe' | 'class' | 'nested_class' | 'spec'
}

export interface TestCaseMetadata {
  framework: TestSuiteMetadata['framework']
  isParameterized: boolean
  parameterSource?: string
  disabled: boolean
}

export interface TestFixtureMetadata {
  framework: TestSuiteMetadata['framework']
  lifecycle: 'before_all' | 'before_each' | 'after_each' | 'after_all' | 'factory'
}
```

新增边类型：

- `tests`：suite 包含 case，或 case 明确指向被测符号；
- `covers`：case/suite 对生产节点的静态覆盖推断；
- `uses_fixture`：case/suite 使用 fixture。

`tests` 用于结构和明确目标，`covers` 用于静态推断或导入/调用证据。所有跨生产代码边继续携带 `confidence`。

```typescript
export interface TestsMetadata {
  relation: 'contains_case' | 'declares_target'
}

export interface CoversMetadata {
  evidence: 'direct_import' | 'direct_call' | 'route_reference' | 'source_mapping'
}

export interface UsesFixtureMetadata {
  usage: 'lexical_scope' | 'parameter' | 'explicit_call'
}
```

### 8.3 TestAdapter

```typescript
export interface TestDiscoveryContext {
  projectRoot: string
  projectMeta: ProjectMeta
  tsConfig: import('typescript').ParsedCommandLine | null
  pathAliases: Record<string, string>
  knownProductionNodes: ReadonlyArray<OmniNode>
}

export interface TestAdapter {
  name: string
  canHandle(filePath: string, context: TestDiscoveryContext): boolean
  discover(
    filePath: string,
    context: TestDiscoveryContext,
  ): Promise<ParseResult>
}
```

适配器由统一 registry 编排，与业务 parser 一样不互相依赖、不访问存储，并遵循 try-catch 降级规则。

### 8.4 TypeScript 支持

- Vitest/Jest：`describe`、`it`、`test`、`test.each`、hooks、显式 imports、mock 与 fixture factory；
- Playwright：`test.describe`、`test`、fixtures、page/API interactions；
- Cypress：`describe`/`context`、`it`、hooks、`cy.*` 访问；
- 从文件命名、依赖、import 和调用形态联合判断框架，避免只靠扩展名。

### 8.5 Kotlin 支持

- JUnit 4/5：`@Test`、`@Before`/`@BeforeEach`、`@After`/`@AfterEach`；
- `@ParameterizedTest` 作为一个测试 case，并把参数源记录到 metadata；
- `@Nested` 形成嵌套 suite；
- Kotest 支持常见 spec 风格及动态 case；
- Gradle XML 仅作为显式导入的运行结果增强，不作为静态发现的前置条件。

### 8.6 执行边界

默认分析不执行目标项目测试。新增显式命令或选项执行测试时必须：

- 由用户明确触发；
- 显示将执行的命令与工作目录；
- 支持超时、取消和输出上限；
- 不通过 shell 拼接未验证参数；
- 执行失败不破坏静态发现快照；
- 将结果作为独立 provenance 附加，而不是覆盖静态事实。

## 9. 安全设计

### 9.1 信任边界

默认绑定 loopback 时保留本机可信、零配置体验。绑定非 loopback 地址时，所有项目数据读取、分析触发、项目切换、AI 调用和 WebSocket 连接均需要鉴权。

### 9.2 会话流程

1. server 启动时在内存保存访问 token 的安全摘要；
2. 浏览器向现有命名空间下的 `/api/session` 提交 access token；
3. server 使用 timing-safe 比较，通过后签发短期随机 session；
4. session 只存在内存中，通过 `HttpOnly; SameSite=Strict` cookie 返回，生产非 loopback HTTPS 场景加 `Secure`；
5. REST 与 WebSocket 共用 session 校验；
6. CLI/API 客户端仍可使用 `Authorization: Bearer <token>`；
7. session 过期、server 重启或 token 轮换后必须重新建立。

session 默认 15 分钟绝对过期，不做无限滑动续期；同一 access token 最多保留受控数量的活跃 session。session 响应不回显 token，日志不得记录 token、cookie 或 AI provider key。鉴权失败统一返回受控错误，不暴露项目是否存在。

### 9.3 AI 路由与出站请求

- AI 路由复用同一 access guard；
- 每会话设置请求频率和并发上限；
- fetch 使用 `AbortSignal.timeout` 或等价机制限制连接与总时长；
- 限制请求体、响应体和流式累计字节；
- provider URL 使用允许的协议和主机策略；
- DNS 解析后，将连接固定到已验证 IP 或在连接层复核远端地址，消除“检查域名后再次解析”的 TOCTOU 窗口；
- 拒绝 loopback、link-local、私网、metadata endpoint 与重定向到禁止地址；
- 错误响应隐藏上游敏感正文。

### 9.4 文件与 WebSocket

- 保留 symlink-aware 项目根路径校验；
- 非 loopback 的读写 API 全量套用 guard；
- WebSocket 同时验证 session/bearer、Origin 与项目作用域；
- 只广播当前项目事件，关闭连接时清理 listener 和 session 引用。

## 10. 存储与可维护性

将 `packages/analyzer/src/storage/db.ts` 按责任拆为：

- `database.ts`：sql.js 生命周期、事务和导入导出；
- `nodeRepository.ts`：节点写入与查询；
- `edgeRepository.ts`：边验证、写入与查询；
- `errorRepository.ts`：解析错误；
- `graphRepository.ts`：组合图读取与清空；
- `statsRepository.ts`：统计查询；
- `persistence.ts`：文件持久化与原子替换；
- `db.ts`：薄兼容 facade。

新增文件应保持单一职责并低于 300 行；修改既有超长文件时必须在对应计划中明确拆分，不要求一次性机械拆完所有历史文件。公共 facade 维持现有调用者兼容，迁移完成后内部模块直接依赖窄接口。

## 11. 测试与 CI

### 11.1 覆盖率门槛

- 全局 lines/functions/statements 不低于 85%；
- 全局 branches 不低于 80%；
- analyzer/server lines 不低于 85%；
- 新增或修改文件 lines 不低于 90%。

覆盖率使用固定 provider 和配置，CI 上传文本/JSON/LCOV 产物；阈值失败即 CI 失败，不使用“仅生成报告”的软门禁。

### 11.2 必需测试层

- shared 类型和序列化契约；
- 每个 parser/test adapter 至少正常、异常、边界三类测试；
- analyzer pipeline 与事务存储集成测试；
- CLI 进程、退出码、stdout/stderr 和 mcp 生命周期测试；
- REST/WS session、bearer、Origin、限流、超时与路径策略测试；
- MCP stdio JSON-RPC 协议 E2E；
- Playwright 真实浏览器 E2E，覆盖启动、加载、切换视图、渐进展开、搜索和错误状态；
- 跨入口快照一致性测试；
- 打包、隔离安装和 clean-registry `npx` 测试。

NestJS 与 Drizzle 必须新增独立行为 fixture 和测试。TypeScript/Kotlin 测试适配器分别使用最小 fixture，避免依赖外部仓库。

### 11.3 CI 与发布

CI 监听 `master` 的 push 与 pull request，并分为静态检查、单元/集成、浏览器 E2E、包验证和依赖审计。正式发布工作流使用 npm provenance 和受保护环境；优先 trusted publishing，若注册表账户要求 2FA，则由用户完成一次性授权，自动化不得绕过。

## 12. 依赖策略

- 先区分生产、开发与 demo 依赖，生产发布门禁只阻止可达的高危生产漏洞；
- 升级 MCP SDK/Hono 和 Demo Next.js 到已修复兼容版本；
- 升级后运行协议、浏览器与打包回归，不用 lockfile 审计替代行为验证；
- 使用 pnpm overrides 只能作为有到期条件的临时措施；
- 新增 `@vitest/coverage-v8` 与 Playwright 是明确质量能力，记录用途和维护状态；
- lockfile 只通过 pnpm 命令生成，不手工修改。

## 13. 文档与上手体验

文档必须与可执行契约同步：

- 根 README：60 秒 quick start、真实截图/GIF、支持矩阵、CLI/Web/MCP 区别、远程安全提示和限制；
- `packages/cli/README.md`：以实际发布包名和命令为准；
- 架构文档：更新为统一内核、快照、当前节点/边模型和测试智能；
- REST 文档：列出当前端点、请求/响应、鉴权、错误码；
- MCP 文档：保持工具名、参数、响应和启动方式一致；
- CONTRIBUTING：修复包过滤命令，给出测试、coverage、E2E 与 release 验证流程；
- cal.com 文档：记录固定 revision、命令、耗时、节点/边数量和已知限制，不保留占位验收；
- CHANGELOG：记录安全行为变化、测试智能和兼容策略。

文档契约测试从 README/文档中提取命令和公开路径，与 Commander/Express/MCP 注册表进行比对，降低再次漂移概率。

## 14. 质量门禁

### Gate 0：冻结基线与公开契约

- 保存基线提交、测试、构建、审计、包内容和评分证据；
- 为 CLI 命令、REST 路径和 MCP 工具名建立契约测试；
- 通过标准：后续重构前已有行为边界可自动比较。

### Gate 1：修复 MCP、CI 与发布阻塞

- MCP 显式启动并通过真实 stdio 握手；
- CI 监听 `master`；
- dry-run、tarball 和隔离安装通过；
- 通过标准：公开 `mcp` 不退出，CI 对实际默认分支生效。

### Gate 2：安全与依赖

- 完成 session/bearer/WS/AI 统一鉴权；
- 修复 DNS rebinding 与 AI 资源限制；
- 消除可达 high 生产依赖漏洞，记录剩余风险；
- 通过标准：安全测试、生产 audit 与依赖回归通过。

### Gate 3：架构与存储

- `detectProject()` 和 `analyzeProject()` 成为唯一实现；
- 旧入口为薄包装器；
- ProjectSnapshot、事务存储、WriteReport 和存储拆分完成；
- 通过标准：故障回滚、降级解析和快照一致性测试通过。

### Gate 4：测试与测试智能

- 配置覆盖率并达到阈值；
- 补齐 NestJS、Drizzle、MCP 协议和浏览器 E2E；
- 实现 TypeScript/Kotlin test adapters；
- 通过标准：静态发现、跨语言 fixture、跨入口一致性和所有 E2E 通过。

### Gate 5：文档同步

- 修复所有已知过期/占位内容；
- 文档契约测试通过；
- 新用户按 README 可在 60 秒内看到 demo；
- 通过标准：命令、协议、截图和实际包内容一致。

### Gate 6：发布与重评

- 执行最终 `pnpm quality:gate`；
- 生成并检查 tarball；
- 发布 npm，验证 provenance/版本/标签；
- 在无 workspace 依赖的临时目录从官方 registry 执行 `npx`；
- 按原权重重新评分并保存证据；
- 通过标准：总分 ≥90、各维度 ≥85、无 P0/P1。

最终 `pnpm quality:gate` 至少串联：格式/静态检查、typecheck、单元测试、覆盖率阈值、集成测试、MCP 协议 E2E、浏览器 E2E、生产依赖审计、文档契约、package dry-run、隔离安装、跨入口快照一致性。

## 15. 回滚策略

- 每个 Gate 使用独立、小型、可回退 commit；
- 数据库 schema 变更保留版本号和迁移/重建路径，本地缓存不可迁移时安全重建，不修改用户源码；
- 新分析内核上线期间保留旧包装器，入口异常可回退 facade 而不恢复重复逻辑；
- session 安全变更若导致远程回归，只允许回退到 bearer-only 的安全模式，不回退到匿名远程读取；
- npm 发布不可覆盖已发布版本，失败修复使用新 patch 版本；
- 发布前保留 tarball 摘要、git tag 和完整门禁日志，可从 tag 重建同一包。

## 16. 实施拆分

实施分成两份可独立验证的计划：

1. **Core Quality 90**：Gate 0–3、核心 Gate 4、Gate 5–6，负责架构、安全、CI、覆盖率、文档和发布；
2. **Cross-language Test Intelligence**：负责 TypeScript/Kotlin 测试发现、连线、快照/UI/协议投影及对应测试。

两份计划都必须在同一个最终发布门禁中会合。测试智能不得绕开统一分析内核另建数据库或入口；核心质量计划必须为测试节点/边预留稳定扩展点。

## 17. 最终验收证据

最终交付至少包含：

- 最终提交哈希与版本号；
- `pnpm quality:gate` 完整通过记录；
- 覆盖率摘要与各包阈值；
- `pnpm audit --prod` 结果及任何剩余风险说明；
- CLI/REST/MCP 相同 fixture 的 snapshot digest；
- MCP stdio 与 Playwright E2E 结果；
- npm 官方 registry 页面/元数据、provenance 和 tarball 摘要；
- 干净临时目录中的 `npx` 命令与输出；
- 按原权重给出的逐维度新评分、扣分项和局限说明。
