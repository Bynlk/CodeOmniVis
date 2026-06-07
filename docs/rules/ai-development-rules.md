# CodeOmniVis AI 开发约束规则

> **适用范围**：所有由 AI（Claude Code / Cursor / 其他 AI 助手）生成或修改的代码
> **强制级别**：违反任何标记为 `[MUST]` 的规则将被拒绝合并
> **日期**：2026-06-06

---

## 1. 核心原则

### 1.1 降级而非崩溃 `[MUST]`

```typescript
// ✅ 正确：无法解析时返回空结果 + warning
async function parseTrpcRouter(file: string): Promise<ParseResult> {
  try {
    return { nodes: await doParseRouter(file), errors: [] }
  } catch (err) {
    return {
      nodes: [],
      errors: [{ file, message: `tRPC parser failed: ${err.message}`, severity: 'warning' }]
    }
  }
}

// ❌ 错误：抛出异常中断整个分析
async function parseTrpcRouter(file: string): Promise<OmniNode[]> {
  return doParseRouter(file)  // 可能抛异常，不允许
}
```

### 1.2 单一职责 `[MUST]`

每个文件只做一件事：

```
✅ parsers/prisma.ts     → 只负责 Prisma schema 解析
✅ resolver/symbolResolver.ts → 只负责跨文件符号追踪
❌ parsers/allParsers.ts → 不允许把所有解析器塞一个文件
```

### 1.3 接口隔离 `[MUST]`

包之间通过类型接口通信，不直接引用内部实现：

```typescript
// ✅ 正确：通过 shared 包的类型通信
import { OmniNode, ParseResult } from '@codeomnivis/shared'

// ❌ 错误：直接引用 analyzer 包的内部类型
import { PrismaParserResult } from '@codeomnivis/analyzer/parsers/prisma'
```

---

## 2. 代码风格

### 2.1 命名规范 `[MUST]`

```
- 文件名：camelCase（prisma.ts、symbolResolver.ts）
- 类型名：PascalCase（OmniNode、ParseResult）
- 函数名：camelCase（parsePrismaSchema、resolvePathAlias）
- 常量：UPPER_SNAKE_CASE（MAX_TRACE_DEPTH、DEFAULT_PORT）
- 接口：不加 I 前缀（用 OmniNode 而非 IOmniNode）
```

### 2.2 注释规范 `[SHOULD]`

```typescript
// ✅ 好的注释：解释 WHY
// Prisma DMMF 不暴露行号，需要用 regex 在原始文件中定位
const line = findLineInFile(schemaPath, model.name)

// ❌ 坏的注释：解释 WHAT（代码本身已经说明）
// 获取行号
const line = findLineInFile(schemaPath, model.name)
```

### 2.3 错误处理 `[MUST]`

```typescript
// 每个 parser 都必须有 try-catch
// 错误信息必须包含：文件路径、错误类型、原始错误消息
// 错误分为三级：error（致命）、warning（可恢复）、info（提示）
```

---

## 3. 解析器约束

### 3.1 解析器接口 `[MUST]`

所有解析器必须实现统一接口：

```typescript
interface Parser {
  name: string
  // 该解析器能处理的文件类型
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean
  // 执行解析
  parse(filePath: string, context: ParseContext): Promise<ParseResult>
}

interface ParseContext {
  projectRoot: string
  tsConfig: ts.ParsedCommandLine | null
  pathAliases: Record<string, string>
}

interface ParseResult {
  nodes: OmniNode[]
  edges: OmniEdge[]
  errors: ParseError[]
}
```

### 3.2 解析器不互相依赖 `[MUST]`

```
✅ prisma.ts 和 trpc.ts 互相独立
✅ 通过 pipeline.ts 编排解析顺序
❌ prisma.ts 内部 import trpc.ts
```

### 3.3 解析器不访问存储 `[MUST]`

```
✅ 解析器只返回 OmniNode[] / OmniEdge[]
✅ 由 pipeline.ts 统一写入 SQLite
❌ 解析器内部直接操作数据库
```

---

## 4. 图数据约束

### 4.1 节点 ID 唯一性 `[MUST]`

```
格式：{type}:{filePath}:{name}
示例：db_model:prisma/schema.prisma:User
示例：page:app/booking/page.tsx:/booking

规则：
- 同一文件中的同类型同名节点，ID 必须相同
- 不同文件中的同名节点，ID 必须不同（通过 filePath 区分）
```

### 4.2 边的 source/target 必须存在 `[MUST]`

```typescript
// 插入边之前，必须验证 source 和 target 节点存在
function addEdge(graph: OmniGraph, edge: OmniEdge): boolean {
  if (!graph.getNode(edge.source) || !graph.getNode(edge.target)) {
    return false  // 节点不存在，跳过该边
  }
  graph.edges.push(edge)
  return true
}
```

### 4.3 confidence 标记 `[MUST]`

```typescript
// certain：通过直接 import 或类型系统确认
// inferred：通过模式匹配推断（可能有误）
// 所有边必须标记 confidence
```

---

## 5. 测试约束

### 5.1 测试文件位置 `[MUST]`

```
源文件：packages/analyzer/src/parsers/prisma.ts
测试文件：packages/analyzer/__tests__/parsers/prisma.test.ts
```

### 5.2 测试覆盖要求 `[SHOULD]`

```
- 每个 parser 至少 3 个测试用例：
  1. 正常输入 → 正确输出
  2. 异常输入 → 优雅降级（不崩溃）
  3. 边界情况（空文件、超大文件、语法错误）
```

### 5.3 测试数据 `[SHOULD]`

```
- 单元测试：使用 __tests__/fixtures/ 中的小型 fixture 文件，不依赖外部项目
- 集成测试：可使用 demo/ 或 cal.com 作为端到端测试数据
- 每个测试用例独立，不依赖执行顺序
```

---

## 6. 性能约束

### 6.1 解析性能 `[SHOULD]`

```
- 单个文件解析：< 100ms
- 100 个文件的项目：< 10 秒
- 1000 个文件的项目：< 60 秒
- 如果超时，输出进度信息
```

### 6.2 内存使用 `[SHOULD]`

```
- 解析过程中不缓存整个 AST
- 使用流式处理大文件
- 超过 1000 个节点时启用分页
```

### 6.3 SQLite 性能 `[MUST]`

```
- 使用事务批量插入（不要逐条插入）
- 使用索引加速查询
- 使用 WAL 模式提高并发性能
```

---

## 7. UI 约束

### 7.1 组件结构 `[MUST]`

```
- 每个组件文件 < 300 行
- 超过 300 行时拆分为子组件
- hooks 和组件分离
- 样式使用 Tailwind CSS
```

### 7.2 状态管理 `[SHOULD]`

```
- 使用 React Query 管理服务端状态
- 使用 useState/useReducer 管理本地状态
- 不引入 Redux/Zustand 等重量级方案（MVP 阶段）
```

### 7.3 可访问性 `[SHOULD]`

```
- 所有交互元素有 aria-label
- 键盘导航支持（Tab、Enter、Escape）
- 颜色对比度符合 WCAG AA 标准
```

---

## 8. API 约束

### 8.1 REST API 格式 `[MUST]`

```typescript
// 成功响应
{ data: T, meta?: { total: number, page: number } }

// 错误响应
{ error: { code: string, message: string, details?: unknown } }

// 状态码：
// 200 - 成功
// 400 - 请求参数错误
// 404 - 资源不存在
// 500 - 服务器内部错误
```

### 8.2 WebSocket 消息格式 `[MUST]`

```typescript
interface WSMessage {
  type: 'graph_updated' | 'analysis_progress' | 'error'
  payload: unknown
  timestamp: number
}
```

---

## 9. Git 约束

### 9.1 Commit 消息格式 `[MUST]`

```
<type>(<scope>): <description>

类型：
- feat: 新功能
- fix: 修复
- refactor: 重构
- test: 测试
- docs: 文档
- chore: 构建/工具

示例：
feat(analyzer): add Prisma schema parser
fix(resolver): handle circular imports gracefully
test(trpc): add nested router test cases
```

### 9.2 分支策略 `[SHOULD]`

```
- main: 稳定版本
- develop: 开发分支
- feature/phase-1: 阶段分支
- fix/xxx: 修复分支
```

---

## 10. AI 特定约束

### 10.1 不允许的 AI 行为 `[MUST]`

```
❌ 不经过思考就生成大量代码
❌ 不检查现有代码就重复实现已有功能
❌ 不理解上下文就修改代码
❌ 生成不符合项目风格的代码
❌ 跳过测试直接提交
❌ 修改计划书而不记录原因
```

### 10.2 AI 必须遵守的流程 `[MUST]`

```
1. 先读取相关文件，理解上下文
2. 检查是否已有类似实现
3. 生成代码前，先说明计划
4. 生成代码后，运行测试
5. 测试通过后，提交代码
6. 如果遇到问题，记录在 docs/plans/changelog.md
```

### 10.3 AI 代码审查清单 `[MUST]`

每次 AI 生成代码后，检查以下项目：

```
□ 是否符合降级原则？
□ 是否有 try-catch 错误处理？
□ 是否遵循命名规范？
□ 是否有必要的注释？
□ 是否可以通过现有测试？
□ 是否需要新增测试？
□ 是否引入了不必要的依赖？
□ 是否影响性能？
```

---

## 11. 依赖管理

### 11.1 新增依赖 `[MUST]`

```
- 必须说明为什么需要这个依赖
- 必须检查是否已有类似功能的依赖
- 必须检查依赖的维护状态（最近 6 个月有更新）
- 必须检查依赖的大小（bundle size）
```

### 11.2 版本锁定 `[MUST]`

```
- 使用 pnpm-lock.yaml 锁定实际安装版本
- package.json 中使用 ^ 前缀（遵循 semver），lock 文件保证精确版本
- 不手动修改 pnpm-lock.yaml
- 定期更新依赖（每月一次），更新后运行完整测试
```

---

## 12. 文档约束

### 12.1 代码文档 `[SHOULD]`

```
- 每个包的 README.md 说明用途和用法
- 每个 parser 说明支持的语法和限制
- 每个 API 端点说明请求/响应格式
```

### 12.2 变更记录 `[MUST]`

```
- 每次计划修改记录在 docs/plans/changelog.md
- 每次重大决策记录在 docs/specs/ 中
- 每次发布记录在 CHANGELOG.md
```

---

*规则文档结束*
