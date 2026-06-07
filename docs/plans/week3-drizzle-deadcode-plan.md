# 第三周计划书：Drizzle ORM + 死代码/循环依赖检测

> 目标：覆盖新兴 ORM、死代码和循环依赖检测
> 完成后可以说："不只是图，还能发现架构问题"

---

## Task 3.1：Drizzle ORM 解析器

Drizzle 是增长最快的 TS ORM，`pgTable`/`mysqlTable`/`sqliteTable` 的 schema 定义。

新建 `packages/analyzer/src/parsers/drizzle.ts`：

### 核心逻辑

1. **表解析**：找所有 `const xxxTable = pgTable('xxx', { ... })` 语句
   - 第一个参数是表名字符串
   - 第二个参数是列定义对象
   - 生成 `db_model` 节点，metadata 含 `tableName`/`fields`/`dialect`

2. **列提取**：解析对象字面量中的属性
   - 识别 Drizzle 列类型：`serial`/`integer`/`text`/`varchar`/`timestamp`/`uuid` 等
   - 检测 `.notNull()`、`.primaryKey()` 链式调用

3. **关系解析**：找 `relations()` 调用
   - `relations(usersTable, ({ one, many }) => ({ posts: many(postsTable) }))`
   - 生成 `db_relation` 边，metadata 含 `relationType: 'one_to_many' | 'one_to_one'`

### 支持的方言

- `pgTable` → dialect: 'pg'
- `mysqlTable` → dialect: 'mysql'
- `sqliteTable` → dialect: 'sqlite'

### 注册

- 修改 `packages/analyzer/src/parsers/index.ts`，注册 `drizzleParser`
- 修改 `autoDetect.ts`，检测 `drizzle-orm` 依赖时设置 `databaseType = 'drizzle'`

---

## Task 3.2：死代码检测

死代码检测在现有图数据上直接运行算法，**不需要新解析器**。

在 `packages/analyzer/src/graph/consistency.ts` 的 `ConsistencyChecker` 类中新增 `detectDeadCode(graph): Issue[]`：

### 检测规则

| 类型 | 规则 | 严重度 |
|------|------|--------|
| `dead_route` | `api_route` / `trpc_procedure` / `express_route` 没有入边 `calls_api` | warning |
| `dead_component` | `component` 没有入边 `renders`，且不是页面文件中的组件 | info |
| `dead_service` | `service` 没有入边 `calls_service` | info |

---

## Task 3.3：循环依赖检测

在 `ConsistencyChecker` 类中新增 `detectCircularDependencies(graph): Issue[]`：

### 算法

使用 **Tarjan 强连通分量**算法在 `imports` 边上检测循环：
1. 构建 `imports` 边的邻接表
2. 运行 Tarjan 算法找 SCC
3. SCC 大小 > 1 表示存在循环依赖

### Issue 输出

```typescript
{
  severity: 'warning',
  type: 'circular_dependency',
  description: `Circular dependency detected: A → B → C → A`,
  locations: [{ file: '...', line: 0 }],
  nodeIds: ['...', '...', '...'],
  metadata: { cycleLength: 3 }
}
```

---

## UI 适配

修改 `IssuesPanel.tsx` 的 `ISSUE_TYPE_CONFIG`，新增：

```typescript
dead_route:          { emoji: '🚫', labelKey: 'issues.deadRoute' },
dead_component:      { emoji: '🗑️', labelKey: 'issues.deadComponent' },
dead_service:        { emoji: '🔇', labelKey: 'issues.deadService' },
circular_dependency: { emoji: '🔄', labelKey: 'issues.circularDep' },
```

修改 `locales/zh-CN.json` 和 `en-US.json`，加入新 issue 类型的文字。

---

## 验收标准

```bash
# Drizzle 验证
npx codeomnivis serve --project ./samples/drizzle-demo
# 期望：db_model 节点出现，含 isDrizzle: true metadata

# 死代码检测验证
npx codeomnivis check
# 期望：输出中出现 dead_route 和 dead_component 类型的问题

# 循环依赖检测验证
# 在 demo 项目中创建循环 import：A imports B, B imports A
npx codeomnivis check
# 期望：输出 circular_dependency 类型的问题
```

---

## 执行时间线

| 天 | 任务 |
|----|------|
| Day 1 | Task 3.1：Drizzle 解析器 |
| Day 2-3 | Task 3.2 + 3.3：死代码 + 循环依赖检测 |
| Day 4 | 验收测试，Issues tab 显示新问题类型 |
