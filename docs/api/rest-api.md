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
| `GET` | `/api/status` | 获取分析新鲜度 |
| `GET` | `/api/project` | 获取当前绝对项目根路径 |
| `POST` | `/api/session` | 用 access token 换取短期浏览器 session |
| `POST` | `/api/analyze` | 触发重新分析 |
| `POST` | `/api/project` | 切换项目并重新分析 |
| `POST` | `/api/ai/chat` | 调用显式配置的 OpenAI 兼容上游 |
| `POST` | `/api/ai/explain` | 使用同一安全策略生成解释 |
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

以下 fenced block 由 `verifyPublicContracts.mjs` 与实际 Express 注册表逐项校验：

```codeomnivis-rest-contract
DELETE /api/graph
GET /api/graph
GET /api/graph/dataflow
GET /api/graph/edges
GET /api/graph/errors
GET /api/graph/issues
GET /api/graph/nodes
GET /api/graph/nodes/:id
GET /api/graph/nodes/:id/edges
GET /api/graph/stats
GET /api/graph/trace
GET /api/health
GET /api/project
GET /api/status
GET /api/tests
POST /api/ai/chat
POST /api/ai/explain
POST /api/analyze
POST /api/project
POST /api/session
```

## 访问控制

默认绑定 `localhost`/`127.0.0.1`/`::1` 时，REST 与 WebSocket 保持零配置访问。

绑定非 loopback host 时必须通过 `--token <token>` 或 `CODEOMNIVIS_TOKEN` 配置 access token，否则 CLI 拒绝启动。除 `/api/health` 外，REST 读取、写入、AI 与 WebSocket 都要求以下任一凭据：

- `Authorization: Bearer <token>`；
- 兼容 header `X-Access-Token: <token>`；
- 由 `POST /api/session` 签发且未过期的 `codeomnivis_session` cookie。

浏览器可向 `/api/session` 提交 `{ "accessToken": "..." }`。成功响应只返回 `expiresAt`，token 不会回显；cookie 使用 `HttpOnly`、`SameSite=Strict`、`Path=/`，默认 15 分钟过期，HTTPS origin 还会添加 `Secure`。未配置远程 token 返回 `403 AUTH_NOT_CONFIGURED`，凭据错误或缺失返回 `401 UNAUTHORIZED`。

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

### `GET /api/status`

返回 `fresh`、`analyzing` 或 `stale` 状态，以及 `lastAnalyzedAt` 和 `pendingChanges`。UI 用它区分已提交快照、正在分析与待刷新状态。

### `GET /api/project` 与 `POST /api/project`

`GET` 返回当前绝对项目根路径。`POST` 接受 `{ "projectRoot": "..." }`，检测目标 metadata，并在成功分析后才切换活动项目；目标检测或分析失败时，旧 root、metadata、graph、diagnostics、freshness 与 watcher 保持不变。

Loopback 服务允许切换到任意现有绝对目录；远程服务把目标限制在启动项目边界内。

### `POST /api/session`

仅用于非 loopback 浏览器。请求体 `{ "accessToken": "..." }` 成功后签发访问控制章节描述的 session cookie，并返回：

```json
{
  "data": { "expiresAt": 1760000000000 },
  "meta": {}
}
```

### `POST /api/analyze`

触发一次完整重新分析。UI 顶栏的“刷新”按钮就是调用这个接口。

示例响应：

```json
{
  "data": {
    "success": true,
    "status": {
      "state": "fresh",
      "lastAnalyzedAt": 1760000000000,
      "pendingChanges": 0
    }
  },
  "meta": {}
}
```

### `POST /api/ai/chat` 与 `POST /api/ai/explain`

两个端点使用相同的请求与安全策略。配置优先级是请求体 `config`，其次为服务端环境变量 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`：

```json
{
  "messages": [{ "role": "user", "content": "Explain this route" }],
  "config": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "...",
    "model": "gpt-5-mini"
  }
}
```

成功响应：

```json
{
  "data": { "content": "..." },
  "meta": {}
}
```

没有任何配置时返回 `501 AI_NOT_CONFIGURED`。服务端只调用解析后的 `/chat/completions` 目标，并执行协议、DNS/IP、重定向、连接 peer、请求/响应大小、超时、按身份速率和并发限制。非 loopback CodeOmniVis 服务默认不允许 AI 上游指向 loopback 地址。

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
    "edgesByType": {},
    "sanitize": {},
    "snapshotId": "...",
    "snapshotDigest": "..."
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

远程 WebSocket upgrade 使用与 REST 相同的 bearer/session 认证，并校验浏览器 `Origin`。服务端完成重新分析或监听到文件变更后，会广播：

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

分析状态变化还会广播：

```json
{
  "type": "status_changed",
  "payload": {
    "state": "analyzing",
    "lastAnalyzedAt": 1760000000000,
    "pendingChanges": 0
  },
  "timestamp": 1760000000000
}
```

前端收到事件后会统一刷新图谱、统计、测试、质量与 freshness 查询。

## 代码位置

- 路由实现：`packages/server/src/routes/graph.ts`
- 服务入口：`packages/server/src/index.ts`
- 路由测试：`packages/server/__tests__/routes/graph.test.ts`
- 扩展测试：`packages/server/__tests__/routes/graph-extended.test.ts`
