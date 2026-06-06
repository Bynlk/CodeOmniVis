# OmniVis 实施计划：Phase 1 + Phase 2
## 跨层连线完整化 × symbolResolver 实现

> 目标：让"三层全栈图"从"三张孤立图"变成真正连通的一张图
> 依据：PROJECT_STATUS.md 实测结果 + 规格文档缺口分析
> 执行方式：可直接作为 Claude Code prompt 使用

---

## 当前问题根因

ByResume 实测：73 个节点，63 个孤立，4 条 `inferred` 跨层连线。

根因链：
```
symbolResolver.ts 不存在
        ↓
crossLayer.ts 只有 linkCallsApi（1/4）
        ↓
handles / calls_service / queries_db 三种边类型全为零
        ↓
DB 层节点和 API 层节点永远断开
        ↓
"全栈一张图"变成"三张独立图"
```

---

## Phase 1 — 跨层连线完整化

**目标完成后的验收标准**：在 demo 项目上，一个 tRPC mutation 节点能连到对应的 Prisma Model 节点，路径为：
`trpc_procedure → handler → (service →) db_model`

**预估工时**：3–4 天

---

### Task 1.1 修复 ConsistencyReport 接口不一致

**优先级**：立即修复（30 分钟），不修会在 `omnivis check` 运行时崩溃

**问题定位**：
```
packages/shared/src/types/issue.ts     → ConsistencyReport.summary
packages/analyzer/src/graph/consistency.ts → 返回了 { stats: ... }
```

**修复方案**：

文件：`packages/analyzer/src/graph/consistency.ts`

找到 `check()` 方法的返回值，将 `stats` 字段名改为 `summary`，确保与 `ConsistencyReport` 接口一致：

```typescript
// 修改前（错误）
return {
  issues: allIssues,
  stats: {              // ← 与接口不符
    total: allIssues.length,
    critical: criticalCount,
    warning: warningCount,
    info: infoCount,
  }
}

// 修改后（正确）
return {
  issues: allIssues,
  summary: {            // ← 与 shared/types/issue.ts 中 ConsistencyReport 接口一致
    total: allIssues.length,
    critical: criticalCount,
    warning: warningCount,
    info: infoCount,
  }
}
```

**验证**：运行 `npx omnivis check` 无运行时错误。

---

### Task 1.2 理解现有 crossLayer.ts 结构

在修改之前，需要先掌握文件的完整结构。

**文件路径**：`packages/analyzer/src/resolver/crossLayer.ts`

现有 `CrossLayerLinker` 类的骨架推断如下（根据 status 报告"仅实现 linkCallsApi，其余注释"）：

```typescript
export class CrossLayerLinker {
  constructor(
    private nodes: OmniNode[],
    private edges: OmniEdge[],
  ) {}

  linkAll(): OmniEdge[] {
    const newEdges: OmniEdge[] = []
    newEdges.push(...this.linkCallsApi())
    // newEdges.push(...this.linkHandles())       // ← 未实现
    // newEdges.push(...this.linkCallsService())   // ← 未实现
    // newEdges.push(...this.linkQueriesDb())      // ← 未实现
    return newEdges
  }

  private linkCallsApi(): OmniEdge[] { /* 已实现 */ }
  private linkHandles(): OmniEdge[] { return [] }       // 桩
  private linkCallsService(): OmniEdge[] { return [] }  // 桩
  private linkQueriesDb(): OmniEdge[] { return [] }     // 桩
}
```

**第一步**：用 Claude Code 读取 `crossLayer.ts` 的完整实际内容，确认结构后再开始修改。

---

### Task 1.3 实现 `linkHandles()`

**作用**：将 `api_route` / `trpc_procedure` / `express_route` 节点连接到它们对应的 handler 函数节点

**产生的边类型**：`handles`

**边方向**：`api_route → handler`（api 路由指向它的处理函数）

---

#### 1.3.1 Next.js API Route 的 handler 提取

Next.js App Router 的 `route.ts` 文件，handler 就是导出的 HTTP method 函数：

```typescript
// app/api/booking/route.ts
export async function POST(req: Request) { ... }  // ← 这就是 handler
export async function GET(req: Request) { ... }   // ← 这也是 handler
```

**实现逻辑**：

```typescript
private linkHandles(): OmniEdge[] {
  const edges: OmniEdge[] = []
  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

  // 处理 Next.js API Route 节点
  const apiRouteNodes = this.nodes.filter(n => n.type === 'api_route')

  for (const routeNode of apiRouteNodes) {
    // 从 metadata 中取出 method（如 'POST'）
    const method = routeNode.metadata?.method as string | undefined
    if (!method) continue

    // 在同一文件中找是否有对应名称的 handler 节点
    // handler 节点 ID 格式为：handler:{filePath}:{functionName}
    const expectedHandlerId = `handler:${routeNode.filePath}:${method}`
    const handlerNode = this.nodes.find(n => n.id === expectedHandlerId)

    if (handlerNode) {
      edges.push(makeEdge(routeNode.id, handlerNode.id, 'handles', 'certain'))
      continue
    }

    // handler 节点不存在时：动态创建（内联 handler）
    // 说明 NextjsAppParser 没有单独提取 handler，需要在这里补充
    const syntheticHandler: OmniNode = {
      id: `handler:${routeNode.filePath}:${method}`,
      type: 'handler',
      name: `${method} handler`,
      filePath: routeNode.filePath,
      line: routeNode.line,
      column: routeNode.column,
      metadata: {
        method,
        parentRouteId: routeNode.id,
        isSynthetic: true,  // 标记为动态创建，非直接解析
      },
    }
    this.nodes.push(syntheticHandler)
    edges.push(makeEdge(routeNode.id, syntheticHandler.id, 'handles', 'certain'))
  }

  // 处理 tRPC procedure 节点
  const trpcNodes = this.nodes.filter(n => n.type === 'trpc_procedure')
  for (const proc of trpcNodes) {
    // tRPC 的 resolver 函数是内联的，直接在 procedure 定义里
    // 创建 synthetic handler 代表 resolver 函数
    const handlerId = `handler:${proc.filePath}:${proc.name}:resolver`
    if (!this.nodes.find(n => n.id === handlerId)) {
      const resolver: OmniNode = {
        id: handlerId,
        type: 'handler',
        name: `${proc.name} resolver`,
        filePath: proc.filePath,
        line: proc.line,
        column: proc.column,
        metadata: {
          procedureType: proc.metadata?.procedureType,
          parentProcedureId: proc.id,
          isSynthetic: true,
        },
      }
      this.nodes.push(resolver)
    }
    edges.push(makeEdge(proc.id, handlerId, 'handles', 'certain'))
  }

  // 处理 Express route 节点
  const expressNodes = this.nodes.filter(n => n.type === 'express_route')
  for (const route of expressNodes) {
    const handlerName = route.metadata?.handlerName as string | undefined
    if (!handlerName) {
      // 内联 callback，创建 synthetic
      const handlerId = `handler:${route.filePath}:${route.name}:callback`
      if (!this.nodes.find(n => n.id === handlerId)) {
        this.nodes.push({
          id: handlerId,
          type: 'handler',
          name: `${route.name} callback`,
          filePath: route.filePath,
          line: route.line,
          column: route.column,
          metadata: { parentRouteId: route.id, isSynthetic: true },
        })
      }
      edges.push(makeEdge(route.id, handlerId, 'handles', 'inferred'))
    } else {
      // 具名 handler（如 bookingController.create）
      // 尝试在现有节点中找匹配
      const existing = this.nodes.find(n =>
        n.type === 'handler' && n.name === handlerName
      )
      if (existing) {
        edges.push(makeEdge(route.id, existing.id, 'handles', 'certain'))
      }
    }
  }

  return edges
}
```

---

#### 1.3.2 辅助函数 `makeEdge()`

在 crossLayer.ts 顶部添加，避免重复代码：

```typescript
function makeEdge(
  source: string,
  target: string,
  type: EdgeType,
  confidence: 'certain' | 'inferred',
  metadata: Record<string, unknown> = {}
): OmniEdge {
  return {
    id: `${source}--${type}--${target}`,
    source,
    target,
    type,
    confidence,
    metadata,
    updatedAt: Date.now(),
  }
}
```

---

### Task 1.4 实现 `linkCallsService()`

**作用**：从 `handler` 节点追踪到它调用的 `service` 层函数

**产生的边类型**：`calls_service`

**边方向**：`handler → service`

**识别"service 调用"的规则**：

满足以下任意条件视为 service 调用：
1. 调用了从 `services/`、`service/` 目录 import 进来的函数
2. 调用了名称以 `Service`、`Repository`、`Repo` 结尾的类的方法
3. 调用了 `ctx.` 开头但不是 `ctx.prisma` 的方法（tRPC context service）

**实现逻辑**：

```typescript
private linkCallsService(): OmniEdge[] {
  const edges: OmniEdge[] = []
  const handlerNodes = this.nodes.filter(n => n.type === 'handler')
  const serviceNodes = this.nodes.filter(n => n.type === 'service')

  for (const handler of handlerNodes) {
    // 获取 handler 对应的源文件路径
    const filePath = handler.filePath

    // 策略1：查找该文件里的 import 语句，找 service 路径的 import
    const serviceImports = this.extractServiceImports(filePath)
    // serviceImports: [{ importedName: 'createBooking', fromPath: '../services/booking' }]

    for (const imp of serviceImports) {
      // 在现有 service 节点中查找匹配
      const matched = serviceNodes.find(s =>
        s.filePath.includes(imp.resolvedPath) && s.name === imp.importedName
      )
      if (matched) {
        edges.push(makeEdge(handler.id, matched.id, 'calls_service', 'certain'))
      } else {
        // service 节点不存在 → 动态创建 synthetic service 节点
        const serviceId = `service:${imp.resolvedPath}:${imp.importedName}`
        if (!this.nodes.find(n => n.id === serviceId)) {
          this.nodes.push({
            id: serviceId,
            type: 'service',
            name: imp.importedName,
            filePath: imp.resolvedPath,
            line: 0,
            column: 0,
            metadata: { isSynthetic: true, importedFrom: filePath },
          })
        }
        edges.push(makeEdge(handler.id, serviceId, 'calls_service', 'inferred'))
      }
    }
  }

  return edges
}

// 辅助：从文件中提取 service 相关 import
private extractServiceImports(filePath: string): ServiceImport[] {
  const imports: ServiceImport[] = []
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      // 匹配：import { xxx } from '../services/...'
      // 匹配：import { xxx } from '@/services/...'
      // 匹配：import XxxService from '...'
      const importMatch = line.match(
        /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]*(?:service|Service|repository|Repository|repo|Repo)[^'"]*)['"]|import\s+(\w+Service|\w+Repository|\w+Repo)\s+from\s+['"]([^'"]+)['"]/i
      )
      if (importMatch) {
        const namedImports = importMatch[1]
        const fromPath = importMatch[2] || importMatch[4]
        const defaultImport = importMatch[3]

        if (namedImports) {
          namedImports.split(',').forEach(name => {
            const trimmed = name.trim()
            if (trimmed) {
              imports.push({
                importedName: trimmed,
                resolvedPath: this.resolveRelativePath(filePath, fromPath),
              })
            }
          })
        }
        if (defaultImport) {
          imports.push({
            importedName: defaultImport,
            resolvedPath: this.resolveRelativePath(filePath, fromPath),
          })
        }
      }
    }
  } catch {
    // 文件读取失败，返回空数组（降级原则）
  }
  return imports
}

private resolveRelativePath(fromFile: string, importPath: string): string {
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), importPath)
  }
  // path alias 或 node_modules，返回原始值作为 fallback
  return importPath
}
```

---

### Task 1.5 实现 `linkQueriesDb()`

**作用**：从 `handler` / `service` 节点找到它执行的数据库操作，连接到对应 `db_model` 节点

**产生的边类型**：`queries_db`

**边方向**：`handler → db_model` 或 `service → db_model`

**识别 DB 调用的模式**：

```typescript
// Prisma 模式
prisma.booking.create(...)       // → db_model: Booking
prisma.booking.findMany(...)     // → db_model: Booking
ctx.prisma.user.findFirst(...)   // → db_model: User
db.session.delete(...)           // → db_model: Session（db 是 prisma 实例的别名）

// TypeORM 模式
this.bookingRepository.save(entity)        // → db_model: Booking
this.bookingRepository.find({ where: ...}) // → db_model: Booking
this.entityManager.save(Booking, data)     // → db_model: Booking（第一个参数是 entity 类）
getRepository(Booking).findOne(id)         // → db_model: Booking
```

**Prisma 调用的正则模式**：
```
/(?:prisma|ctx\.prisma|db|this\.prisma)\s*\.\s*(\w+)\s*\.\s*(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)/g
```
→ 捕获组 1 是 model 名（首字母大写 or 小写驼峰）

**实现逻辑**：

```typescript
private linkQueriesDb(): OmniEdge[] {
  const edges: OmniEdge[] = []
  const dbNodes = this.nodes.filter(n => n.type === 'db_model')
  const callerNodes = this.nodes.filter(n =>
    n.type === 'handler' || n.type === 'service'
  )

  const PRISMA_PATTERN = /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\s*\.\s*(\w+)\s*\.\s*(?:findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)/g

  const TYPEORM_REPO_PATTERN = /this\.(\w+)(?:Repository|Repo|repository|repo)\s*\.\s*(?:save|find|findOne|findOneBy|findBy|update|delete|remove|count|exist|insert)/g

  const TYPEORM_ENTITY_PATTERN = /(?:getRepository|this\.entityManager\.save|this\.entityManager\.find)\s*\(\s*(\w+)/g

  for (const caller of callerNodes) {
    let content: string
    try {
      content = fs.readFileSync(caller.filePath, 'utf-8')
    } catch {
      continue  // 降级：读取失败跳过
    }

    const foundModels = new Set<string>()

    // 扫描 Prisma 调用
    let match: RegExpExecArray | null
    PRISMA_PATTERN.lastIndex = 0
    while ((match = PRISMA_PATTERN.exec(content)) !== null) {
      const rawModelName = match[1]
      const modelName = capitalize(rawModelName)  // booking → Booking
      foundModels.add(modelName)
    }

    // 扫描 TypeORM repository 调用
    TYPEORM_REPO_PATTERN.lastIndex = 0
    while ((match = TYPEORM_REPO_PATTERN.exec(content)) !== null) {
      // this.bookingRepository → 推断 model 为 Booking
      const repoName = match[1]
      const modelName = capitalize(repoName.replace(/(?:Repository|Repo)$/i, ''))
      foundModels.add(modelName)
    }

    // 扫描 TypeORM entity class 直接引用
    TYPEORM_ENTITY_PATTERN.lastIndex = 0
    while ((match = TYPEORM_ENTITY_PATTERN.exec(content)) !== null) {
      foundModels.add(match[1])
    }

    // 对每个找到的 model 名，连接到对应 db_model 节点
    for (const modelName of foundModels) {
      const dbNode = dbNodes.find(n =>
        n.name === modelName ||
        n.name.toLowerCase() === modelName.toLowerCase()
      )

      if (dbNode) {
        const edgeId = `${caller.id}--queries_db--${dbNode.id}`
        if (!this.edges.find(e => e.id === edgeId)) {
          edges.push(makeEdge(caller.id, dbNode.id, 'queries_db', 'certain'))
        }
      }
      // 未匹配到 db_model：说明这个 model 还没被 Prisma/TypeORM 解析器提取
      // 不创建 synthetic，静默跳过（降级原则）
    }
  }

  return edges
}

// 辅助
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
```

---

### Task 1.6 解除 `linkAll()` 中的注释

所有四个方法实现完成后，修改 `linkAll()`：

```typescript
linkAll(): OmniEdge[] {
  const newEdges: OmniEdge[] = []
  newEdges.push(...this.linkCallsApi())
  newEdges.push(...this.linkHandles())       // ← 解除注释
  newEdges.push(...this.linkCallsService())  // ← 解除注释
  newEdges.push(...this.linkQueriesDb())     // ← 解除注释
  return newEdges
}
```

---

### Task 1.7 修复 calls_api 边的验证跳过

**文件**：`packages/analyzer/src/graph/builder.ts`

**现状**：calls_api 边目前跳过 source/target 节点存在性验证，允许无效边入库。

**修复策略**：不是简单恢复验证（那会让所有 inferred 连线都失效），而是分级处理：

```typescript
// 修改前（跳过验证）
if (edge.type === 'calls_api') {
  insertEdge(edge)  // 无条件插入
  continue
}

// 修改后（分级验证）
if (edge.type === 'calls_api') {
  const sourceExists = nodeIndex.has(edge.source)
  const targetExists = nodeIndex.has(edge.target)

  if (sourceExists && targetExists) {
    // 两端都存在：正常插入
    insertEdge(edge)
  } else if (sourceExists && edge.confidence === 'inferred') {
    // 目标不存在但是 inferred 边：标记为 unresolved，仍然插入
    // 这类边在图里显示为虚线，不影响完整性检测
    insertEdge({ ...edge, metadata: { ...edge.metadata, unresolved: true } })
  }
  // 其他情况（source 不存在）：丢弃，不入库
  continue
}
```

---

### Phase 1 验收测试

在 demo 项目上运行 `npx omnivis serve`，打开 UI，检查：

| 检查项 | 期望结果 |
|--------|---------|
| `handles` 边 | tRPC procedure 节点有出边连到 handler |
| `calls_service` 边 | handler 节点有出边连到 service（如果 demo 有 service 层） |
| `queries_db` 边 | handler/service 节点有出边连到 Prisma model |
| 孤立节点数量 | 应从 63 降至 < 30（部分仍孤立是正常的） |
| omnivis check | 无 runtime 错误，summary 字段正确显示 |

---

---

## Phase 2 — 实现 `symbolResolver.ts`

**目标**：真正的跨文件符号追踪。Phase 1 用的是文件内正则扫描（能找到直接 Prisma 调用），Phase 2 用 ts-morph 做精确的函数调用图追踪（能穿越函数调用边界）。

**核心场景差异**：

```typescript
// Phase 1 能处理：直接调用
export async function POST(req) {
  return prisma.booking.create({ data: req.body })  // ← 正则能找到
}

// Phase 2 才能处理：间接调用
export async function POST(req) {
  return await bookingService.create(req.body)  // ← 要追踪进 bookingService.create
}
// bookingService.create 在另一个文件里调用了 prisma.booking.create
```

**预估工时**：3–4 天

---

### Task 2.1 创建文件骨架

**文件路径**：`packages/analyzer/src/resolver/symbolResolver.ts`

```typescript
import {
  Project,
  SourceFile,
  Node,
  SyntaxKind,
  CallExpression,
  FunctionDeclaration,
  ArrowFunction,
  MethodDeclaration,
  FunctionExpression,
} from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'
import type { OmniNode, OmniEdge } from '@omnivis/shared'

export interface DbCall {
  modelName: string         // 'Booking'
  operation: string         // 'create', 'findMany', etc.
  filePath: string          // 调用所在文件
  line: number              // 行号
  confidence: 'certain' | 'inferred'
}

export interface TraceResult {
  dbCalls: DbCall[]
  callChain: string[]       // ['handler:...', 'service:...']（中间经过的节点 ID）
  errors: string[]          // 追踪过程中的非致命错误
}

type FunctionLike =
  | FunctionDeclaration
  | ArrowFunction
  | MethodDeclaration
  | FunctionExpression

export class SymbolResolver {
  private project: Project
  private visited = new Set<string>()     // 防止循环：filePath:functionName
  private MAX_DEPTH = 5

  constructor(tsConfigPath: string) {
    if (!fs.existsSync(tsConfigPath)) {
      throw new Error(`tsconfig not found: ${tsConfigPath}`)
    }
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: false,
      compilerOptions: {
        skipLibCheck: true,    // 加快解析速度
        noEmit: true,
      },
    })
  }

  // ── 公共入口 ──────────────────────────────────

  /**
   * 给定一个 handler 节点，追踪到它最终操作的所有 DB 模型
   * @param handlerNode  来自 OmniGraph 的 handler 节点
   * @returns TraceResult
   */
  async traceHandlerToDb(handlerNode: OmniNode): Promise<TraceResult> {
    this.visited.clear()

    const fn = this.findFunctionByNode(handlerNode)
    if (!fn) {
      return {
        dbCalls: [],
        callChain: [],
        errors: [`Cannot find function for node ${handlerNode.id}`],
      }
    }

    return this.traceFunction(fn, handlerNode.id, 0)
  }

  // ── 核心递归追踪 ──────────────────────────────

  private traceFunction(
    fn: FunctionLike,
    currentNodeId: string,
    depth: number
  ): TraceResult {
    const result: TraceResult = { dbCalls: [], callChain: [currentNodeId], errors: [] }

    if (depth >= this.MAX_DEPTH) {
      result.errors.push(`Max depth ${this.MAX_DEPTH} reached at ${currentNodeId}`)
      return result
    }

    const visitKey = this.getFunctionKey(fn)
    if (this.visited.has(visitKey)) {
      return result  // 防止循环调用
    }
    this.visited.add(visitKey)

    // 提取函数体中的所有 CallExpression
    const callExprs = fn.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const callExpr of callExprs) {
      // ① 先检查是否是终态的 Prisma / TypeORM 调用
      const dbCall = this.extractDbCall(callExpr)
      if (dbCall) {
        result.dbCalls.push(dbCall)
        continue
      }

      // ② 尝试解析 callee 到函数定义，递归追踪
      if (depth < this.MAX_DEPTH - 1) {
        const calleeFn = this.resolveCallee(callExpr)
        if (calleeFn) {
          const calleeKey = this.getFunctionKey(calleeFn)
          const calleeNodeId = this.buildServiceNodeId(calleeFn)

          const sub = this.traceFunction(calleeFn, calleeNodeId, depth + 1)
          result.dbCalls.push(...sub.dbCalls)
          result.callChain.push(...sub.callChain)
          result.errors.push(...sub.errors)
        }
      }
    }

    return result
  }

  // ── Callee 解析 ───────────────────────────────

  /**
   * 给定一个 CallExpression，返回被调用函数的 AST 节点
   * 核心：利用 ts-morph 的类型系统跨文件追踪
   */
  private resolveCallee(callExpr: CallExpression): FunctionLike | null {
    try {
      const expr = callExpr.getExpression()

      // 尝试通过 TypeScript 类型系统找到定义
      const definitions = expr.getType()
        ?.getCallSignatures()
        .flatMap(sig => sig.getDeclaration() ? [sig.getDeclaration()!] : [])

      if (definitions && definitions.length > 0) {
        const def = definitions[0]
        if (this.isFunctionLike(def)) {
          // 排除 node_modules 中的定义
          const srcFile = def.getSourceFile().getFilePath()
          if (!srcFile.includes('node_modules')) {
            return def as FunctionLike
          }
        }
      }

      // fallback：通过符号查找
      const symbol = expr.getType().getSymbol()
        ?? expr.getType().getAliasSymbol()

      if (!symbol) return null

      const decls = symbol.getDeclarations()
      for (const decl of decls) {
        if (this.isFunctionLike(decl)) {
          const srcFile = decl.getSourceFile().getFilePath()
          if (!srcFile.includes('node_modules')) {
            return decl as FunctionLike
          }
        }
      }
    } catch {
      // 类型解析失败（常见于复杂泛型）：静默返回 null
    }
    return null
  }

  // ── DB 调用检测 ───────────────────────────────

  /**
   * 检测一个 CallExpression 是否是 Prisma 或 TypeORM 的 DB 操作
   */
  private extractDbCall(callExpr: CallExpression): DbCall | null {
    const callText = callExpr.getText()
    const exprText = callExpr.getExpression().getText()

    // Prisma 调用模式：prisma.model.operation() / ctx.prisma.model.op()
    const prismaMatch = exprText.match(
      /(?:prisma|ctx\.prisma|db|this\.prisma|this\.db)\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)$/
    )
    if (prismaMatch) {
      return {
        modelName: capitalize(prismaMatch[1]),
        operation: prismaMatch[2],
        filePath: callExpr.getSourceFile().getFilePath(),
        line: callExpr.getStartLineNumber(),
        confidence: 'certain',
      }
    }

    // TypeORM Repository 调用：this.bookingRepo.save() / this.bookingRepository.find()
    const typeormMatch = exprText.match(
      /this\.(\w+?)(?:Repository|Repo)\.(save|find|findOne|findOneBy|findBy|update|delete|remove|count|insert|exist)$/i
    )
    if (typeormMatch) {
      return {
        modelName: capitalize(typeormMatch[1]),
        operation: typeormMatch[2],
        filePath: callExpr.getSourceFile().getFilePath(),
        line: callExpr.getStartLineNumber(),
        confidence: 'certain',
      }
    }

    // TypeORM EntityManager：this.entityManager.save(Booking, data)
    const emMatch = exprText.match(
      /this\.entityManager\.(save|find|findOne|remove|update|delete)/
    )
    if (emMatch) {
      // 第一个参数是 Entity class
      const args = callExpr.getArguments()
      if (args.length > 0) {
        const entityName = args[0].getText()
        if (/^[A-Z]/.test(entityName)) {  // 首字母大写说明是 class
          return {
            modelName: entityName,
            operation: emMatch[1],
            filePath: callExpr.getSourceFile().getFilePath(),
            line: callExpr.getStartLineNumber(),
            confidence: 'inferred',
          }
        }
      }
    }

    return null
  }

  // ── 工具方法 ──────────────────────────────────

  /**
   * 根据 OmniNode 定位到 ts-morph 中的函数节点
   */
  private findFunctionByNode(node: OmniNode): FunctionLike | null {
    try {
      const sourceFile = this.project.getSourceFile(node.filePath)
        ?? this.project.addSourceFileAtPath(node.filePath)

      if (!sourceFile) return null

      // 策略1：按行号定位（最精确）
      if (node.line > 0) {
        const fn = this.findFunctionAtLine(sourceFile, node.line)
        if (fn) return fn
      }

      // 策略2：按函数名定位
      const name = this.extractFunctionName(node)
      if (name) {
        return this.findFunctionByName(sourceFile, name)
      }
    } catch {
      // 文件加载失败，返回 null（降级原则）
    }
    return null
  }

  private findFunctionAtLine(
    sourceFile: SourceFile,
    targetLine: number
  ): FunctionLike | null {
    // 找到包含目标行的最小函数节点
    const all: FunctionLike[] = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ]

    return all.find(fn => {
      const start = fn.getStartLineNumber()
      const end = fn.getEndLineNumber()
      return targetLine >= start && targetLine <= end
    }) ?? null
  }

  private findFunctionByName(
    sourceFile: SourceFile,
    name: string
  ): FunctionLike | null {
    // 先找命名函数
    const named = sourceFile.getFunction(name)
    if (named) return named

    // 再找 const name = () => {}
    const varDecl = sourceFile.getVariableDeclaration(name)
    if (varDecl) {
      const init = varDecl.getInitializer()
      if (init && Node.isArrowFunction(init)) return init
      if (init && Node.isFunctionExpression(init)) return init
    }

    // 在 class 方法中找
    for (const cls of sourceFile.getClasses()) {
      const method = cls.getMethod(name)
      if (method) return method
    }

    return null
  }

  private extractFunctionName(node: OmniNode): string | null {
    // node.name 对于 handler 可能是 'POST handler'，提取 'POST'
    const parts = node.name.split(' ')
    if (parts.length > 0) return parts[0]
    return null
  }

  private isFunctionLike(node: Node): boolean {
    return (
      Node.isFunctionDeclaration(node) ||
      Node.isArrowFunction(node) ||
      Node.isMethodDeclaration(node) ||
      Node.isFunctionExpression(node)
    )
  }

  private getFunctionKey(fn: FunctionLike): string {
    const file = fn.getSourceFile().getFilePath()
    const line = fn.getStartLineNumber()
    return `${file}:${line}`
  }

  private buildServiceNodeId(fn: FunctionLike): string {
    const file = fn.getSourceFile().getFilePath()
    const name = Node.isFunctionDeclaration(fn)
      ? fn.getName() ?? 'anonymous'
      : Node.isMethodDeclaration(fn)
        ? fn.getName()
        : 'anonymous'
    return `service:${file}:${name}`
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
```

---

### Task 2.2 将 SymbolResolver 集成到 crossLayer.ts

Phase 2 对 crossLayer 的改造：

**在构造函数中注入 SymbolResolver**：

```typescript
import { SymbolResolver, type DbCall } from './symbolResolver'

export class CrossLayerLinker {
  private symbolResolver: SymbolResolver | null = null

  constructor(
    private nodes: OmniNode[],
    private edges: OmniEdge[],
    private tsConfigPath?: string,   // 新增可选参数
  ) {
    if (tsConfigPath) {
      try {
        this.symbolResolver = new SymbolResolver(tsConfigPath)
      } catch {
        // tsconfig 不存在或无效：降级，不使用符号追踪
        this.symbolResolver = null
      }
    }
  }

  // ...
}
```

**增强 `linkQueriesDb()`，优先使用符号追踪**：

```typescript
private async linkQueriesDbWithSymbols(): Promise<OmniEdge[]> {
  const edges: OmniEdge[] = []
  const dbNodes = this.nodes.filter(n => n.type === 'db_model')
  const callerNodes = this.nodes.filter(n =>
    n.type === 'handler' || n.type === 'service'
  )

  for (const caller of callerNodes) {
    let dbCalls: DbCall[] = []

    if (this.symbolResolver) {
      // Phase 2：精确符号追踪
      try {
        const result = await this.symbolResolver.traceHandlerToDb(caller)
        dbCalls = result.dbCalls

        // 将追踪中发现的中间 service 节点动态加入图
        for (const nodeId of result.callChain) {
          if (nodeId.startsWith('service:') && !this.nodes.find(n => n.id === nodeId)) {
            this.nodes.push({
              id: nodeId,
              type: 'service',
              name: nodeId.split(':')[2] ?? 'unknown',
              filePath: nodeId.split(':')[1] ?? '',
              line: 0, column: 0,
              metadata: { discoveredBySymbolResolver: true },
            })
          }
        }
      } catch {
        // 符号追踪失败：降级到正则扫描
        dbCalls = this.scanFileForDbCalls(caller.filePath)
      }
    } else {
      // Phase 1 降级：正则扫描
      dbCalls = this.scanFileForDbCalls(caller.filePath)
    }

    for (const call of dbCalls) {
      const dbNode = dbNodes.find(n =>
        n.name === call.modelName ||
        n.name.toLowerCase() === call.modelName.toLowerCase()
      )
      if (dbNode) {
        const edgeId = `${caller.id}--queries_db--${dbNode.id}`
        if (!this.edges.find(e => e.id === edgeId)) {
          edges.push(makeEdge(caller.id, dbNode.id, 'queries_db', call.confidence))
        }
      }
    }
  }

  return edges
}
```

**注意**：由于 `symbolResolver.traceHandlerToDb` 是 async，`linkAll()` 也需要变成 async：

```typescript
async linkAll(): Promise<OmniEdge[]> {
  const newEdges: OmniEdge[] = []
  newEdges.push(...this.linkCallsApi())
  newEdges.push(...this.linkHandles())
  newEdges.push(...this.linkCallsService())
  newEdges.push(...await this.linkQueriesDbWithSymbols())  // ← async
  return newEdges
}
```

对应地，调用方（`serve.ts`、`analyze.ts` 等）改为 `await linker.linkAll()`。

---

### Task 2.3 传入 tsConfigPath 到 CrossLayerLinker

**文件**：`packages/cli/src/commands/serve.ts`（以及 analyze.ts、check.ts）

找到 CrossLayerLinker 的实例化位置，增加 tsConfigPath 参数：

```typescript
// 修改前
const linker = new CrossLayerLinker(nodes, edges)

// 修改后
import { findTsConfig } from '../utils/autoDetect'

const tsConfigPath = findTsConfig(projectRoot)  // 自动查找 tsconfig.json
const linker = new CrossLayerLinker(nodes, edges, tsConfigPath)
```

`findTsConfig` 逻辑：

```typescript
// packages/cli/src/utils/autoDetect.ts（已有文件，追加函数）
export function findTsConfig(root: string): string | undefined {
  // 优先查找 apps/web/tsconfig.json（monorepo 前端包）
  const candidates = [
    path.join(root, 'tsconfig.json'),
    path.join(root, 'apps', 'web', 'tsconfig.json'),
    path.join(root, 'app', 'tsconfig.json'),
    path.join(root, 'src', 'tsconfig.json'),
  ]
  return candidates.find(p => fs.existsSync(p))
}
```

---

### Task 2.4 性能保护措施

ts-morph 在大型 monorepo（如 cal.com）上初始化可能需要 5-10 秒，需要防止阻塞 CLI 输出。

**措施 1：带超时的 Promise 包装**

```typescript
// packages/analyzer/src/resolver/symbolResolver.ts

async traceHandlerToDb(
  handlerNode: OmniNode,
  timeoutMs = 5000
): Promise<TraceResult> {
  return Promise.race([
    this._doTrace(handlerNode),
    new Promise<TraceResult>((resolve) =>
      setTimeout(() => resolve({
        dbCalls: [],
        callChain: [],
        errors: [`Timeout after ${timeoutMs}ms for ${handlerNode.id}`],
      }), timeoutMs)
    ),
  ])
}
```

**措施 2：结果缓存（防止同文件重复解析）**

```typescript
private traceCache = new Map<string, TraceResult>()

async traceHandlerToDb(handlerNode: OmniNode): Promise<TraceResult> {
  const key = handlerNode.id
  if (this.traceCache.has(key)) {
    return this.traceCache.get(key)!
  }
  const result = await this._doTrace(handlerNode)
  this.traceCache.set(key, result)
  return result
}
```

**措施 3：在 CLI 输出中显示符号追踪进度**

```typescript
// packages/cli/src/commands/serve.ts
const spinner = ora('Tracing cross-layer calls...').start()
const newEdges = await linker.linkAll()
spinner.succeed(`Found ${newEdges.filter(e => e.type === 'queries_db').length} DB call chains`)
```

---

### Task 2.5 为 SymbolResolver 添加单元测试

**文件**：`packages/analyzer/src/__tests__/symbolResolver.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { SymbolResolver } from '../resolver/symbolResolver'
import * as path from 'path'

// 使用 demo 项目作为测试目标
const DEMO_TSCONFIG = path.resolve(__dirname, '../../../../demo/tsconfig.json')
const DEMO_ROUTE = path.resolve(__dirname, '../../../../demo/app/api/booking/route.ts')

describe('SymbolResolver', () => {
  let resolver: SymbolResolver

  beforeAll(() => {
    resolver = new SymbolResolver(DEMO_TSCONFIG)
  })

  it('should find Prisma calls in a Next.js route handler', async () => {
    const handlerNode = {
      id: 'handler:demo/app/api/booking/route.ts:POST',
      type: 'handler' as const,
      name: 'POST handler',
      filePath: DEMO_ROUTE,
      line: 1,
      column: 0,
      metadata: {},
    }

    const result = await resolver.traceHandlerToDb(handlerNode)

    expect(result.errors).toHaveLength(0)
    expect(result.dbCalls.length).toBeGreaterThan(0)
    expect(result.dbCalls[0].modelName).toBe('Booking')
    expect(['create', 'findMany', 'findFirst']).toContain(result.dbCalls[0].operation)
  })

  it('should trace through service layer calls', async () => {
    // 如果 demo 有 service 层，测试间接追踪
    // 跳过条件：demo 无 service 层
  })

  it('should not crash on files with no DB calls', async () => {
    const uiNode = {
      id: 'handler:demo/components/Hero.tsx:Hero',
      type: 'handler' as const,
      name: 'Hero',
      filePath: path.resolve(__dirname, '../../../../demo/components/Hero.tsx'),
      line: 1,
      column: 0,
      metadata: {},
    }

    const result = await resolver.traceHandlerToDb(uiNode)
    expect(result.dbCalls).toHaveLength(0)
    // 不应该 throw
  })

  it('should respect MAX_DEPTH and not infinite loop', async () => {
    // 创建一个深度超过 5 的调用链的测试用例（需要 demo 项目配合）
    // 验证 errors 中包含 "Max depth" 信息
  })
})
```

---

### Phase 2 验收测试

在 demo 项目上运行 `npx omnivis serve`，检查：

| 检查项 | 期望结果 |
|--------|---------|
| `queries_db` 边数量 | 应 > 0，每个操作 Prisma 的 handler 都有出边 |
| DB 模型连通性 | db_model 节点应有 > 0 条入边（来自 handler/service） |
| 三层连通性 | 选中一个 page 节点，应能沿边追踪到 db_model |
| 孤立节点比例 | 应从 Phase 1 的 < 30 进一步降低 |
| 性能 | demo 项目分析总时间 < 30 秒 |
| 不崩溃 | cal.com 项目上 `npx omnivis serve` 不报 fatal error |

---

## 执行顺序总结

```
Day 1 上午  Task 1.1  修复 ConsistencyReport 接口（30分钟）
Day 1 上午  Task 1.2  理解现有 crossLayer.ts 结构（阅读代码）
Day 1 下午  Task 1.3  实现 linkHandles()
Day 2 上午  Task 1.4  实现 linkCallsService()
Day 2 下午  Task 1.5  实现 linkQueriesDb()（正则版）
Day 2 下午  Task 1.6  解除 linkAll() 注释 + 修复 calls_api 验证
Day 2 晚    Phase 1 验收：demo 项目测试

Day 3 上午  Task 2.1  创建 symbolResolver.ts 骨架 + extractDbCall()
Day 3 下午  Task 2.2  实现 resolveCallee() + traceFunction()
Day 4 上午  Task 2.3  集成到 crossLayer.ts（async linkAll）
Day 4 下午  Task 2.4  性能保护（超时 + 缓存）+ 测试
Day 4 晚    Phase 2 验收：demo 项目 + cal.com 不崩溃
```

---

*计划书版本：1.0 | 针对 PROJECT_STATUS.md 70% 完成度状态制定*
