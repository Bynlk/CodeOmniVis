# 第三周 Claude Code Prompts

> Drizzle ORM 解析器 + 死代码/循环依赖检测

---

## Prompt 3-A：Drizzle 解析器

```
你是 CodeOmniVis 项目的开发者。

1. 读取 packages/analyzer/src/parsers/prisma.ts（参考 db_model 节点生成模式）
2. 读取 packages/analyzer/src/parsers/index.ts

3. 创建 packages/analyzer/src/parsers/drizzle.ts：

import { Project, SyntaxKind, CallExpression, Node } from 'ts-morph'

const DRIZZLE_TABLE_FUNCTIONS = ['pgTable', 'mysqlTable', 'sqliteTable', 'pgSchema']
const DRIZZLE_COLUMN_TYPES = [
  'serial', 'integer', 'bigint', 'boolean', 'text', 'varchar', 'char',
  'numeric', 'real', 'doublePrecision', 'timestamp', 'date', 'time',
  'json', 'jsonb', 'uuid', 'customType'
]

export const drizzleParser = {
  name: 'drizzle' as const,

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (!filePath.endsWith('.ts') || filePath.includes('node_modules')) return false
    const content = fs.readFileSync(filePath, 'utf-8')
    return DRIZZLE_TABLE_FUNCTIONS.some(fn => content.includes(fn))
  },

  parse(filePath: string, context: ParseContext): ParseResult {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const sourceFile = context.project.addSourceFileAtPath(filePath)

    sourceFile.getVariableDeclarations().forEach(varDecl => {
      const initializer = varDecl.getInitializer()
      if (!initializer || !Node.isCallExpression(initializer)) return

      const callee = initializer.getExpression().getText()
      const tableFunc = DRIZZLE_TABLE_FUNCTIONS.find(fn => callee.endsWith(fn))
      if (!tableFunc) return

      const args = initializer.getArguments()
      if (args.length < 1) return

      const tableNameArg = args[0]
      const tableName = tableNameArg.getText().replace(/['"]/g, '')

      const columnsArg = args[1]
      const fields = columnsArg ? extractDrizzleColumns(columnsArg) : []

      const varName = varDecl.getName()
      const displayName = varName.replace(/Table$|Schema$/i, '')
      const modelName = capitalize(displayName)

      nodes.push({
        id: `db_model:${filePath}:${modelName}`,
        type: 'db_model',
        name: modelName,
        filePath,
        line: varDecl.getStartLineNumber(),
        column: 0,
        metadata: {
          tableName,
          variableName: varName,
          fieldCount: fields.length,
          fields,
          isDrizzle: true,
          dialect: tableFunc.replace('Table', ''),
        },
      })
    })

    // 解析 relations
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
      if (!callExpr.getExpression().getText().endsWith('relations')) return

      const args = callExpr.getArguments()
      if (args.length < 2) return

      const sourceTableVar = args[0].getText()
      const relFn = args[1]

      const relationCalls = relFn.getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter(c => ['many', 'one'].includes(c.getExpression().getText()))

      for (const rel of relationCalls) {
        const targetVar = rel.getArguments()[0]?.getText()
        if (!targetVar) continue

        const relType = rel.getExpression().getText()
        const sourceModelName = capitalize(sourceTableVar.replace(/Table$/, ''))
        const targetModelName = capitalize(targetVar.replace(/Table$/, ''))

        edges.push({
          id: `db_model:${filePath}:${sourceModelName}--db_relation--db_model::${targetModelName}`,
          source: `db_model:${filePath}:${sourceModelName}`,
          target: `db_model::${targetModelName}`,
          type: 'db_relation',
          confidence: 'inferred',
          metadata: { relationType: relType === 'many' ? 'one_to_many' : 'one_to_one' },
          updatedAt: Date.now(),
        })
      }
    })

    return { nodes, edges }
  }
}

function extractDrizzleColumns(columnsNode: Node): FieldDef[] {
  if (!Node.isObjectLiteralExpression(columnsNode)) return []
  return columnsNode.getProperties()
    .filter(p => Node.isPropertyAssignment(p))
    .map(p => {
      const prop = p as PropertyAssignment
      const init = prop.getInitializer()
      const colType = init
        ? DRIZZLE_COLUMN_TYPES.find(t => init.getText().startsWith(t)) ?? 'unknown'
        : 'unknown'
      return {
        name: prop.getName(),
        type: colType,
        isRequired: init?.getText().includes('.notNull()') ?? false,
        isId: prop.getName() === 'id' || init?.getText().includes('primaryKey') ?? false,
        isRelation: false,
      }
    })
}

4. 修改 packages/analyzer/src/parsers/index.ts，注册 drizzleParser

5. 修改 packages/cli/src/utils/autoDetect.ts，
   检测 Drizzle：package.json 中含 drizzle-orm 依赖时设置 databaseType = 'drizzle'

6. 创建 fixture：packages/analyzer/__tests__/fixtures/drizzle/schema.ts
   内容：
   import { pgTable, serial, text, integer, relations } from 'drizzle-orm/pg-core'
   export const usersTable = pgTable('users', { id: serial('id').primaryKey(), name: text('name').notNull(), age: integer('age') })
   export const postsTable = pgTable('posts', { id: serial('id').primaryKey(), content: text('content'), authorId: integer('author_id') })
   export const usersRelations = relations(usersTable, ({ many }) => ({ posts: many(postsTable) }))

7. 创建测试：packages/analyzer/__tests__/parsers/drizzle.test.ts
   测试：解析 schema.ts → 生成 users 和 posts db_model 节点 + db_relation 边

8. pnpm test 通过，pnpm build 通过
```

---

## Prompt 3-B：死代码 + 循环依赖检测

```
你是 CodeOmniVis 项目的开发者。

1. 读取 packages/analyzer/src/graph/consistency.ts 完整内容
2. 读取 packages/shared/src/types/issue.ts，确认 Issue 接口的字段

3. 在 ConsistencyChecker 类中新增两个方法：

─── detectDeadCode(graph: OmniGraph): Issue[] ───

detectDeadCode(graph: OmniGraph): Issue[] {
  const issues: Issue[] = []
  const allNodes = graph.nodes
  const allEdges = graph.edges

  // 死路由：api_route / trpc_procedure 没有入边 calls_api
  const routeNodes = allNodes.filter(n =>
    n.type === 'api_route' || n.type === 'trpc_procedure' || n.type === 'express_route'
  )
  for (const route of routeNodes) {
    const hasCallers = allEdges.some(e => e.target === route.id && e.type === 'calls_api')
    if (!hasCallers) {
      issues.push({
        severity: 'warning',
        type: 'dead_route',
        description: `Route "${route.name}" is defined but never called by any frontend component`,
        locations: [{ file: route.filePath, line: route.line }],
        nodeIds: [route.id],
      })
    }
  }

  // 死组件：component 没有入边 renders，且不是页面
  const pageFiles = new Set(
    allNodes.filter(n => n.type === 'page').map(n => n.filePath)
  )
  const componentNodes = allNodes.filter(n => n.type === 'component')
  for (const comp of componentNodes) {
    if (pageFiles.has(comp.filePath)) continue
    const hasRenderers = allEdges.some(e =>
      e.target === comp.id && e.type === 'renders'
    )
    if (!hasRenderers) {
      issues.push({
        severity: 'info',
        type: 'dead_component',
        description: `Component "${comp.name}" is never rendered by any other component`,
        locations: [{ file: comp.filePath, line: comp.line }],
        nodeIds: [comp.id],
      })
    }
  }

  // 死 Service：service 没有入边 calls_service
  const serviceNodes = allNodes.filter(n => n.type === 'service')
  for (const svc of serviceNodes) {
    const hasCallers = allEdges.some(e =>
      e.target === svc.id && e.type === 'calls_service'
    )
    if (!hasCallers) {
      issues.push({
        severity: 'info',
        type: 'dead_service',
        description: `Service "${svc.name}" is never called`,
        locations: [{ file: svc.filePath, line: svc.line }],
        nodeIds: [svc.id],
      })
    }
  }

  return issues
}

─── detectCircularDependencies(graph: OmniGraph): Issue[] ───

detectCircularDependencies(graph: OmniGraph): Issue[] {
  const issues: Issue[] = []
  const importEdges = graph.edges.filter(e => e.type === 'imports')

  const adj = new Map<string, Set<string>>()
  const nodeMap = new Map<string, OmniNode>(graph.nodes.map(n => [n.id, n]))

  for (const edge of importEdges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set())
    adj.get(edge.source)!.add(edge.target)
  }

  // Tarjan 强连通分量
  const index = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const sccs: string[][] = []
  let counter = 0

  function strongconnect(v: string) {
    index.set(v, counter)
    lowlink.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)

    for (const w of (adj.get(v) ?? [])) {
      if (!index.has(w)) {
        strongconnect(w)
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)
      sccs.push(scc)
    }
  }

  for (const node of graph.nodes) {
    if (!index.has(node.id)) {
      strongconnect(node.id)
    }
  }

  for (const scc of sccs) {
    if (scc.length > 1) {
      const cycleNodes = scc.map(id => nodeMap.get(id)).filter(Boolean) as OmniNode[]
      const fileList = [...new Set(cycleNodes.map(n => n.filePath))]

      issues.push({
        severity: 'warning',
        type: 'circular_dependency',
        description: `Circular dependency detected: ${cycleNodes.map(n => n.name).join(' → ')}`,
        locations: fileList.map(f => ({ file: f, line: 0 })),
        nodeIds: scc,
        metadata: { cycleLength: scc.length },
      })
    }
  }

  return issues
}

4. 修改 check() 主方法，在 issues 数组中加入这两个方法的结果

5. 修改 packages/shared/src/types/issue.ts 中的 IssueType，
   新增：'dead_route' | 'dead_component' | 'dead_service' | 'circular_dependency'

6. 修改 packages/ui/src/components/TabBar/IssuesPanel.tsx，
   在 ISSUE_TYPE_CONFIG 对象中加入四个新类型的 emoji 和 i18n key：
   dead_route:          { emoji: '🚫', labelKey: 'issues.deadRoute' },
   dead_component:      { emoji: '🗑️', labelKey: 'issues.deadComponent' },
   dead_service:        { emoji: '🔇', labelKey: 'issues.deadService' },
   circular_dependency: { emoji: '🔄', labelKey: 'issues.circularDep' },

7. 修改 locales/zh-CN.json 和 en-US.json，加入新 issue 类型的文字

8. pnpm test 通过，pnpm build 通过
```
