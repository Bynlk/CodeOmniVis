# CodeOmniVis REST API

CodeOmniVis 在执行 `serve` 后会启动一个 HTTP 服务，默认地址是 `http://localhost:4321`。这套接口既供前端 UI 使用，也可以给你自己的工具或脚本直接调用。

除了 HTTP，服务端还会在 `ws://localhost:4321/ws` 暴露一个 WebSocket，用于图更新通知。

## 响应约定

### 成功响应

```json
{
  "data": {},
  "meta": {}
}
```

### 错误响应

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to load graph data"
  }
}
```

## 端点总览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/analyze` | 触发重新分析 |
| `POST` | `/api/ai/chat` | 预留 AI 聊天接口，当前返回 `501` |
| `GET` | `/api/graph` | 获取完整图谱 |
| `GET` | `/api/graph/nodes` | 获取所有节点，可按类型过滤 |
| `GET` | `/api/graph/nodes/:id` | 获取单个节点 |
| `GET` | `/api/graph/nodes/:id/edges` | 获取某节点的入边和出边 |
| `GET` | `/api/graph/edges` | 获取所有边，可按类型过滤 |
| `GET` | `/api/graph/stats` | 获取图谱统计信息 |
| `GET` | `/api/graph/errors` | 获取解析错误列表 |
| `GET` | `/api/graph/issues` | 获取确定性质量与安全发现 |
| `GET` | `/api/graph/trace` | 从节点双向追踪调用链 |
| `GET` | `/api/graph/dataflow` | 获取数据流概览或某个模型的详细路径 |
| `GET` | `/api/tests` | 获取静态发现的测试结构与覆盖关系 |
| `DELETE` | `/api/graph` | 清空图数据，需要确认 header |

## 详细说明

### `GET /api/health`

最简单的健康检查接口。

示例响应：

```json
{
  "status": "ok",
  "timestamp": 1760000000000
}
```

### `POST /api/analyze`

触发一次完整重新分析。UI 顶栏的“刷新”按钮就是调用这个接口。

示例响应：

```json
{
  "data": {
    "success": true,
    "message": "Analysis completed",
    "filesScanned": 123
  },
  "meta": {}
}
```

### `POST /api/ai/chat`

当前是保留接口，服务端会返回 `501`：

```json
{
  "error": "AI chat not yet implemented",
  "message": "Connect your API key in settings to enable AI features"
}
```

### `GET /api/graph`

返回完整图谱以及基础统计：

```json
{
  "data": {
    "nodes": [],
    "edges": []
  },
  "meta": {
    "nodeCount": 0,
    "edgeCount": 0,
    "nodesByType": {},
    "edgesByType": {}
  }
}
```

### `GET /api/graph/nodes`

返回所有节点。支持通过 `type` 过滤：

```text
GET /api/graph/nodes?type=db_model
```

当前服务端接受的节点类型包括：

- `page`
- `component`
- `api_route`
- `trpc_procedure`
- `express_route`
- `handler`
- `service`
- `db_model`
- `module`
- `tsrpc_service`
- `tsrpc_api`
- `tsrpc_msg`
- `kotlin_class`
- `kotlin_interface`
- `kotlin_object`
- `kotlin_function`
- `kotlin_route`
- `test_suite`
- `test_case`
- `test_fixture`

当 `type` 非法时会返回 `400`。

### `GET /api/graph/nodes/:id`

按节点 ID 获取单个节点。路径中的 `:id` 需要做 URL 编码。

### `GET /api/graph/nodes/:id/edges`

获取某个节点的入边和出边：

```json
{
  "data": {
    "inEdges": [],
    "outEdges": []
  },
  "meta": {
    "inCount": 0,
    "outCount": 0
  }
}
```

### `GET /api/graph/edges`

返回所有边。支持通过 `type` 过滤：

```text
GET /api/graph/edges?type=renders
```

当前服务端接受的边类型包括：

- `renders`
- `navigates_to`
- `calls_api`
- `handles`
- `calls_service`
- `queries_db`
- `db_relation`
- `imports`
- `contains`
- `data_flows_to`
- `sends_msg`
- `listens_msg`
- `kotlin_inherits`
- `kotlin_implements`
- `kotlin_uses`
- `tests`
- `covers`
- `uses_fixture`

### `GET /api/graph/stats`

返回图谱统计数据，供统计面板使用。

典型字段：

- `nodeCount`
- `edgeCount`
- `errorCount`
- `nodeTypeCounts`
- `edgeTypeCounts`

### `GET /api/graph/errors`

返回解析错误列表，供问题面板使用：

```json
{
  "data": [
    {
      "file": "src/example.ts",
      "message": "Failed to parse ...",
      "severity": "warning"
    }
  ],
  "meta": {
    "count": 1
  }
}
```

### `GET /api/graph/dataflow`

不带参数时，返回所有数据库模型的数据流概览：

```text
GET /api/graph/dataflow
```

带 `model` 参数时，返回单个模型的详细路径：

```text
GET /api/graph/dataflow?model=User
```

如果指定模型不存在，会返回 `404`。

### `GET /api/tests`

返回与当前已提交快照一致的静态测试视图。可选 query：

```text
GET /api/tests?framework=vitest
GET /api/tests?target=OrdersService
```

`framework` 接受 `vitest`、`jest`、`playwright`、`cypress`、`junit4`、`junit5` 或 `kotest`；非法值会按未提供过滤器处理。`target` 会匹配生产节点 ID、名称或文件路径。

```json
{
  "data": {
    "suites": [],
    "cases": [],
    "fixtures": [],
    "coverage": [],
    "summary": {
      "suites": 0,
      "cases": 0,
      "fixtures": 0,
      "coveredTargets": 0,
      "uncoveredTargets": 0,
      "byFramework": {}
    }
  },
  "meta": {
    "snapshotId": "...",
    "snapshotDigest": "..."
  }
}
```

`coverage` 中的 `covers` 边表示静态 import、call 或 route-reference 证据，不是运行时行覆盖率。详细语义见[测试智能指南](../guides/test-intelligence.md)。

### `DELETE /api/graph`

清空数据库中的图数据。这个接口要求请求头带上：

```text
X-Confirm: true
```

否则会返回 `400`，防止误操作。

## WebSocket

连接地址：

```text
ws://localhost:4321/ws
```

当服务端完成重新分析或监听到文件变更后，会广播：

```json
{
  "type": "graph_updated",
  "payload": {
    "nodes": [],
    "edges": []
  },
  "timestamp": 1760000000000
}
```

前端收到该事件后，会刷新图谱、统计和错误列表。

## 代码位置

- 路由实现：`packages/server/src/routes/graph.ts`
- 服务入口：`packages/server/src/index.ts`
- 路由测试：`packages/server/__tests__/routes/graph.test.ts`
- 扩展测试：`packages/server/__tests__/routes/graph-extended.test.ts`
