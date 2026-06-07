# 第四周计划书：数据流追踪（Model → API → Component）

> 目标：追踪一个类型从数据库定义，经过 API 层，传播到前端组件的完整路径
> 完成后可以说："市面上没有的东西"

---

## 概念说明

这是整个项目技术含量最高的功能。

**追踪链路**：
```
Prisma Model: User { id, name, email }
      ↓ 类型传播
API Handler: async function getUser(): Promise<User>
      ↓ 类型传播
tRPC Procedure: user.getById → output: UserSchema
      ↓ 类型传播
React Component: const { data: user } = trpc.user.getById.useQuery()
      ↓
JSX: <div>{user.name}</div>  ← 最终消费点
```

---

## Task 4.1：DataFlowTracer 类

新建 `packages/analyzer/src/resolver/dataFlowTracer.ts`：

### 核心接口

```typescript
export interface DataFlowPath {
  modelNode: OmniNode          // 数据起点：db_model
  apiNodes: OmniNode[]         // 中间层：api_route / trpc_procedure
  componentNodes: OmniNode[]   // 终点：component
  edges: DataFlowEdge[]        // 连接各层的数据流边
}

export interface DataFlowEdge {
  from: string
  to: string
  typeName: string
  transferMethod: 'return_type' | 'prop_type' | 'hook_data' | 'prisma_result'
  file: string
  line: number
}
```

### 主方法 `traceModelFlow(modelNode): DataFlowPath`

1. **Step 1**：找查询这个 model 的所有 handler/service（通过 `queries_db` 边反向）
2. **Step 2**：对每个 caller，用 ts-morph 提取返回类型，如果返回类型包含 model 名称 → 找父级 API 路由
3. **Step 3**：从 API 节点向前找使用这些数据的组件（通过 `calls_api` 边），验证组件是否真的消费了这个类型

### 辅助方法

- `findQueryCallers(modelNode)` — 找 `queries_db` 边的源节点
- `extractReturnType(node)` — 用 ts-morph 提取函数返回类型
- `extractUsedTypes(componentNode)` — 提取组件中使用的类型（含 tRPC hook 返回类型）
- `findParentApiRoute(node)` — 通过 `handles` 边向上找 API 路由

---

## Task 4.2：新边类型 `data_flows_to`

在 `packages/shared/src/types/edge.ts` 的 `EdgeType` union 中新增 `'data_flows_to'`。

DataFlowTracer 运行后，将结果转为 `OmniEdge` 存入数据库：

```typescript
function dataFlowPathToEdges(path: DataFlowPath): OmniEdge[] {
  return path.edges.map(e => ({
    id: `${e.from}--data_flows_to--${e.to}:${e.typeName}`,
    source: e.from,
    target: e.to,
    type: 'data_flows_to' as EdgeType,
    confidence: 'inferred',
    metadata: {
      typeName: e.typeName,
      transferMethod: e.transferMethod,
    },
    updatedAt: Date.now(),
  }))
}
```

---

## Task 4.3：数据流视图（UI）

新建 `packages/ui/src/components/TabBar/DataFlowPanel.tsx`：

### 功能

1. **Model 选择器**：显示所有 `db_model` 节点作为可点击按钮
2. **路径展示**：选中后显示 `🗄️ User → 2 routes → 3 components` 的流式布局
3. **图高亮**：选中后调用 `highlightDataFlowPath()` 高亮路径

### API 端点

在 `packages/server/src/routes/graph.ts` 新增：

```
GET /api/graph/dataflow?model=User
```

返回 `DataFlowPath` 结构。

---

## Task 4.4：在图中高亮数据流路径

修改 `packages/ui/src/hooks/useGraphFilter.ts`，新增：

### `highlightDataFlowPath(path: DataFlowPath)`

- 收集路径中所有节点 ID
- 非路径节点 opacity 降为 0.15
- 数据流边高亮为金色（`#f59e0b`），宽度 3

### `clearHighlight()`

- 恢复所有节点和边的 opacity

---

## Tab 注册

修改 `packages/ui/src/types/tabs.ts`，在 TABS 数组中新增：

```typescript
{ id: 'dataflow', labelKey: 'tab.dataflow', emoji: '🌊', panelComponent: DataFlowPanel }
```

修改 `locales/zh-CN.json` 和 `en-US.json`：

```json
{
  "tab.dataflow": "数据流",
  "dataflow.title": "选择一个数据库模型，追踪数据流向"
}
```

---

## 验收标准

```bash
# 数据流追踪验证
npx codeomnivis serve
# 在 UI 中：
# 1. 点击 Tab: "Data Flow"
# 2. 点击一个 DB Model（如 User）
# 3. 面板显示：🗄️ User → 2 routes → 3 components
# 4. 图中路径高亮为金色
```

---

## 执行时间线

| 天 | 任务 |
|----|------|
| Day 1-2 | Task 4.1：DataFlowTracer + API 端点 |
| Day 3-4 | Task 4.2 + 4.3 + 4.4：DataFlowPanel UI + 图高亮 |
| Day 5 | cal.com 端到端测试 + GIF 录制 + README 更新 |
