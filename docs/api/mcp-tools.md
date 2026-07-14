# CodeOmniVis MCP Tools

CodeOmniVis 内置一个基于 stdio 的 MCP Server，用于把“项目架构查询能力”暴露给 Cursor、Claude Desktop 等支持 MCP 的客户端。

推荐启动方式：

```bash
node packages/cli/bin/codeomnivis.js mcp --project /absolute/path/to/your-repo
```

`mcp` 命令会把 `--project` 的绝对目标路径直接传给 stdio MCP runtime，随后基于该路径加载或生成缓存数据库。

## 启动行为

首次启动某个项目时：

1. 计算缓存路径 `~/.codeomnivis/projects/{hash}.db`
2. 如果缓存不存在，先执行完整分析
3. 初始化数据库实例并缓存
4. 通过 stdio 对外提供工具

后续工具调用会复用同一个数据库实例，而不是每次重新扫仓库。

## 工具总览

| 工具 | 输入 | 输出重点 |
| --- | --- | --- |
| `get_api_routes` | `filter?: string` | API / tRPC / TSRPC 路由列表、调用方、下游 DB 操作 |
| `get_component_tree` | `rootPath: string`, `depth?: number` | 以某个页面或组件为根的渲染树 |
| `find_callers` | `target: string` | 调用者列表和受影响前端页面 |
| `list_db_models` | 无 | 数据库模型清单 |
| `get_dataflow` | `model?: string` | 模型到 API、组件的数据流摘要 |
| `get_test_coverage` | `target?: string`, `framework?: string` | 测试 suite/case/fixture、静态覆盖边与快照身份 |

## 工具详情

### `get_api_routes`

返回所有 API 入口，包括：

- `api_route`
- `trpc_procedure`
- `express_route`
- `tsrpc_api`
- `tsrpc_service`

输入：

```json
{
  "filter": "booking"
}
```

典型输出字段：

- `method`
- `path`
- `file`
- `line`
- `calledBy`
- `dbOperations`

适合问：

- “有哪些 booking 相关接口？”
- “哪些 API 直接或间接查了数据库？”

### `get_component_tree`

按路由或文件路径获取组件树。

输入：

```json
{
  "rootPath": "/booking",
  "depth": 3
}
```

或者：

```json
{
  "rootPath": "components/BookingList.tsx",
  "depth": 2
}
```

如果找不到根节点，工具会返回带 `suggestion` 的说明，而不是直接抛错。

适合问：

- “Booking 页面最终渲染了哪些组件？”
- “这个组件下面还有几层子组件？”

### `find_callers`

按名称、路由或文件路径查找调用者，并附带受影响前端页面。

输入：

```json
{
  "target": "/api/booking"
}
```

典型输出字段：

- `target`
- `targetType`
- `file`
- `callers`
- `affectedFrontendPages`

适合问：

- “谁在调用 `/api/booking`？”
- “如果我改 User 模型，会影响哪些页面？”

### `list_db_models`

列出数据库模型，不需要输入参数。

输出字段包括：

- `id`
- `name`
- `file`
- `tableName`
- `fieldCount`

适合问：

- “这个项目里有哪些模型？”
- “Prisma / TypeORM / Drizzle 一共定义了多少表？”

### `get_dataflow`

获取模型级别的数据流概览，或者追踪某一个模型。

概览输入：

```json
{}
```

指定模型：

```json
{
  "model": "User"
}
```

典型输出字段：

- `model`
- `routes`
- `components`
- `summary`

适合问：

- “User 数据从 DB 走到哪些 API，再走到哪些组件？”
- “哪些模型已经真正被前端消费？”

### `get_test_coverage`

查询静态发现的测试结构，以及测试 case 与生产节点之间的 `covers` 关系。

输入可省略：

```json
{}
```

也可以按框架和生产目标过滤：

```json
{
  "framework": "junit5",
  "target": "Order"
}
```

`framework` 支持 `vitest`、`jest`、`playwright`、`cypress`、`junit4`、`junit5` 与 `kotest`。输出包含：

- `suites`、`cases`、`fixtures`
- `coverage`
- `summary`（总数、已连接/未连接 target、按框架计数）
- `snapshot`（与 CLI、REST、Web 相同的已提交快照）

这里的 `coverage` 是静态 import/call/route-reference 证据，不是运行时行覆盖率。参数化声明保持一个稳定静态 case；动态运行行只会通过显式 JUnit XML import 进入 provenance。完整限制见[测试智能指南](../guides/test-intelligence.md)。

## MCP 客户端配置示例

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "node",
      "args": [
        "/absolute/path/to/CodeOmniVis/packages/cli/bin/codeomnivis.js",
        "mcp",
        "--project",
        "/absolute/path/to/your-repo"
      ]
    }
  }
}
```

如果你已经把 `codeomnivis` 安装到 `PATH`，可以把配置改成：

```json
{
  "mcpServers": {
    "codeomnivis": {
      "command": "codeomnivis",
      "args": ["mcp", "--project", "/absolute/path/to/your-repo"]
    }
  }
}
```

## 代码位置

- MCP 入口：`packages/mcp/src/index.ts`
- CLI 包装：`packages/cli/src/commands/mcp.ts`
- 工具测试：`packages/mcp/__tests__/tools.test.ts`
