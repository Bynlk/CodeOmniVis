# 第四周 Claude Code Prompts

> 数据流追踪（Model → API → Component）

---

## Prompt 4-A：DataFlowTracer + API 端点

```
你是 OmniVis 项目的开发者。

1. 读取 packages/analyzer/src/resolver/symbolResolver.ts（参考 ts-morph 使用模式）
2. 读取 packages/shared/src/types/edge.ts

3. 在 EdgeType union 中新增 'data_flows_to'

4. 创建 packages/analyzer/src/resolver/dataFlowTracer.ts：

import { Project, Type, TypeChecker, Node, SyntaxKind } from 'ts-morph'
import type { OmniNode, OmniEdge, OmniGraph } from '@omnivis/shared'

export interface DataFlowPath {
  modelNode: OmniNode
  apiNodes: OmniNode[]
  componentNodes: OmniNode[]
  edges: DataFlowEdge[]
}

export interface DataFlowEdge {
  from: string
  to: string
  typeName: string
  transferMethod: 'return_type' | 'prop_type' | 'hook_data' | 'prisma_result'
  file: string
  line: number
}

export class DataFlowTracer {
  private project: Project
  private graph: OmniGraph
  private typeCache = new Map<string, Type>()

  constructor(tsConfigPath: string, graph: OmniGraph) {
    this.project = new Project({ tsConfigFilePath: tsConfigPath })
    this.graph = graph
  }

  traceModelFlow(modelNode: OmniNode): DataFlowPath {
    const modelTypeName = modelNode.name

    // Step 1: 找到查询这个 model 的所有 handler/service
    const queryCallers = this.findQueryCallers(modelNode)

    // Step 2: 对每个 caller，追踪其返回类型
    const apiNodes: OmniNode[] = []
    const dataFlowEdges: DataFlowEdge[] = []

    for (const caller of queryCallers) {
      const returnTypes = this.extractReturnType(caller)

      if (returnTypes.some(t => t.includes(modelTypeName))) {
        const apiRoute = this.findParentApiRoute(caller)
        if (apiRoute) {
          apiNodes.push(apiRoute)
          dataFlowEdges.push({
            from: modelNode.id,
            to: apiRoute.id,
            typeName: modelTypeName,
            transferMethod: 'prisma_result',
            file: caller.filePath,
            line: caller.line,
          })
        }
      }
    }

    // Step 3: 从 API 节点向前找使用这些数据的组件
    const componentNodes: OmniNode[] = []
    for (const apiNode of apiNodes) {
      const callers = this.graph.edges
        .filter(e => e.target === apiNode.id && e.type === 'calls_api')
        .map(e => this.graph.nodes.find(n => n.id === e.source))
        .filter(Boolean) as OmniNode[]

      for (const comp of callers) {
        const usedTypes = this.extractUsedTypes(comp)
        if (usedTypes.some(t => t.includes(modelTypeName))) {
          componentNodes.push(comp)
          dataFlowEdges.push({
            from: apiNode.id,
            to: comp.id,
            typeName: modelTypeName,
            transferMethod: 'hook_data',
            file: comp.filePath,
            line: comp.line,
          })
        }
      }
    }

    return { modelNode, apiNodes, componentNodes, edges: dataFlowEdges }
  }

  private findQueryCallers(modelNode: OmniNode): OmniNode[] {
    return this.graph.edges
      .filter(e => e.target === modelNode.id && e.type === 'queries_db')
      .map(e => this.graph.nodes.find(n => n.id === e.source))
      .filter(Boolean) as OmniNode[]
  }

  private extractReturnType(node: OmniNode): string[] {
    try {
      const sourceFile = this.project.getSourceFile(node.filePath)
        ?? this.project.addSourceFileAtPath(node.filePath)

      const functions = [
        ...sourceFile.getFunctions(),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ]

      const targetFn = functions.find(f => {
        const fnName = Node.isFunctionDeclaration(f) ? f.getName()
          : Node.isMethodDeclaration(f) ? f.getName()
          : null
        return fnName === node.name.split('.').pop()
      })

      if (!targetFn) return []

      const retType = 'getReturnType' in targetFn
        ? (targetFn as any).getReturnType()
        : null

      return retType ? [retType.getText()] : []
    } catch {
      return []
    }
  }

  private extractUsedTypes(componentNode: OmniNode): string[] {
    try {
      const sourceFile = this.project.getSourceFile(componentNode.filePath)
        ?? this.project.addSourceFileAtPath(componentNode.filePath)

      const types: string[] = []

      sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(varDecl => {
        const type = varDecl.getType()
        types.push(type.getText())
      })

      sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
        if (call.getExpression().getText().includes('.useQuery')
            || call.getExpression().getText().includes('.useMutation')) {
          const retType = call.getType()
          types.push(retType.getText())
        }
      })

      return types
    } catch {
      return []
    }
  }

  private findParentApiRoute(node: OmniNode): OmniNode | null {
    const handlesEdge = this.graph.edges.find(e =>
      e.target === node.id && e.type === 'handles'
    )
    if (!handlesEdge) return null
    return this.graph.nodes.find(n => n.id === handlesEdge.source) ?? null
  }
}

5. 修改 packages/server/src/routes/graph.ts，
   新增 GET /api/graph/dataflow 端点：

router.get('/dataflow', async (req, res) => {
  const modelName = req.query.model as string
  if (!modelName) return res.status(400).json({ error: 'model is required' })

  const projectRoot = req.app.locals.projectRoot as string
  const dbPath = getDbPath(projectRoot)
  const db = new OmniDatabase(dbPath)
  const graph = db.getFullGraph()

  const tsConfigPath = findTsConfig(projectRoot)
  if (!tsConfigPath) {
    return res.json({ data: null, meta: { error: 'tsconfig.json not found' } })
  }

  const tracer = new DataFlowTracer(tsConfigPath, graph)
  const modelNode = graph.nodes.find(n => n.type === 'db_model' && n.name === modelName)

  if (!modelNode) {
    return res.status(404).json({ error: `Model ${modelName} not found` })
  }

  const flowPath = tracer.traceModelFlow(modelNode)
  res.json({ data: flowPath, meta: {} })
})

6. pnpm build，确认无 TypeScript 错误

7. 手动测试：
   curl "http://localhost:4321/api/graph/dataflow?model=User"
   期望：返回包含 modelNode / apiNodes / componentNodes 的 JSON
```

---

## Prompt 4-B：DataFlowPanel UI + 图高亮

```
你是 OmniVis 项目的开发者。

1. 读取 packages/ui/src/components/TabBar/StatsPanel.tsx（参考 Panel 结构）
2. 读取 packages/ui/src/hooks/useGraphFilter.ts

3. 创建 packages/ui/src/components/TabBar/DataFlowPanel.tsx：

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function DataFlowPanel() {
  const { t } = useTranslation()
  const { data: dbModels } = useQuery({
    queryKey: ['nodes', 'db_model'],
    queryFn: async () => {
      const res = await fetch('/api/graph/nodes?type=db_model')
      return (await res.json()).data as OmniNode[]
    }
  })

  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const { data: flowPath } = useQuery({
    queryKey: ['dataflow', selectedModel],
    enabled: !!selectedModel,
    queryFn: async () => {
      const res = await fetch(`/api/graph/dataflow?model=${selectedModel}`)
      return (await res.json()).data as DataFlowPath
    }
  })

  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">
        {t('dataflow.title')}
      </h3>

      <div className="mb-4 flex flex-wrap gap-2">
        {dbModels?.map(model => (
          <button
            key={model.id}
            onClick={() => setSelectedModel(model.name)}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition-colors',
              selectedModel === model.name
                ? 'bg-pink-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            🗄️ {model.name}
          </button>
        ))}
      </div>

      {flowPath && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <FlowStep icon="🗄️" label={flowPath.modelNode.name} type="db_model" />
          <FlowArrow label={`${flowPath.apiNodes.length} routes`} />
          <div className="flex flex-col gap-1">
            {flowPath.apiNodes.map(n => (
              <FlowStep key={n.id} icon="🔗" label={n.name} type="api_route" small />
            ))}
          </div>
          <FlowArrow label={`${flowPath.componentNodes.length} components`} />
          <div className="flex flex-col gap-1">
            {flowPath.componentNodes.map(n => (
              <FlowStep key={n.id} icon="🧩" label={n.name} type="component" small />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-slate-400">→</span>
    </div>
  )
}

4. 修改 useGraphFilter.ts，新增两个方法：

highlightDataFlowPath(path: DataFlowPath) {
  const cy = cyRef.current
  if (!cy) return

  const pathNodeIds = new Set([
    path.modelNode.id,
    ...path.apiNodes.map(n => n.id),
    ...path.componentNodes.map(n => n.id),
  ])

  cy.batch(() => {
    cy.nodes().forEach(node => {
      node.style('opacity', pathNodeIds.has(node.id()) ? 1 : 0.15)
    })

    cy.edges().forEach(edge => {
      const isFlowEdge = path.edges.some(
        e => e.from === edge.source().id() && e.to === edge.target().id()
      )
      edge.style({
        opacity: isFlowEdge ? 1 : 0.1,
        lineColor: isFlowEdge ? '#f59e0b' : undefined,
        width: isFlowEdge ? 3 : undefined,
      })
    })
  })
}

clearHighlight() {
  cy?.batch(() => {
    cy.nodes().style('opacity', 1)
    cy.edges().style({ opacity: 1, lineColor: undefined, width: undefined })
  })
}

5. 修改 packages/ui/src/types/tabs.ts，
   在 TABS 数组中新增：
   { id: 'dataflow', labelKey: 'tab.dataflow', emoji: '🌊', panelComponent: DataFlowPanel }

6. 修改 locales/zh-CN.json 和 en-US.json：
   "tab.dataflow": "数据流" / "Data Flow"
   "dataflow.title": "选择一个数据库模型，追踪数据流向" / "Select a DB model to trace data flow"

7. 修改 DataFlowPanel：当用户选择一个 model 并拿到 flowPath 后，
   调用 highlightDataFlowPath(flowPath)
   当用户关闭 Panel 或取消选择时，调用 clearHighlight()

8. pnpm build 通过，浏览器里 Data Flow tab 可以正常展示路径
```
