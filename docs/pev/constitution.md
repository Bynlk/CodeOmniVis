# CodeOmniVis 技术铁律（Constitution）

> 不可违反的约束。极少变，变了必须 review 并追加一条 decision 说明。

## 来源
- 项目既有 monorepo 配置（pnpm workspace + turborepo）
- 需求来源：docs/pev/managed/requirements/frontend-redesign-brief_v1.md
- 本期为**前端重构**任务，不改动后端与数据契约。

## 技术栈铁律

### 项目级硬约束（全局，后端相关）
- **后端框架：必须含 TSRPC（项目硬约束）**
- **数据库：必须含 MongoDB（项目硬约束）**
- 说明：本期前端重构**不触碰后端**，仅通过既有 HTTP/WS 接口消费数据。上述后端硬约束在本期不产生代码改动，但作为项目铁律登记在册，未来后端开发必须遵守。

### 前端铁律（本期直接约束）
- 语言：TypeScript + React 18（禁止改用其他框架）
- 图渲染引擎：**Cytoscape 3 + dagre，不可替换**
- 样式：Tailwind 3 + postcss + autoprefixer（禁止引入外部 CDN）
- 实时通信：原生 WebSocket
- 构建：Vite 5 + tsup
- 国际化：i18next + react-i18next
- 服务器状态：@tanstack/react-query（已在依赖中）

## 数据契约铁律（100% 兼容，禁止破坏）
- `OmniGraph { nodes, edges }`；17 种 NodeType、15 种 EdgeType，字段与类型保持不变。
- 12 个服务器 API 端点（GET /api/graph、/api/graph/stats、/api/graph/nodes、/api/graph/dataflow、/api/graph/errors、/api/status、/api/health；POST /api/analyze、/api/project、/api/ai/chat、/api/ai/explain）契约不变。

## 流程铁律
- 每个 feature 完成必须先 /pev-verify（独立子代理判卷）再由 /pev 归档。
- 所有网络请求必须收敛到 `packages/ui/src/services/` 服务层，禁止组件内散落 fetch。
- 状态分层：服务器状态走 React Query；UI 状态走独立 store/context；Cytoscape 实例走 ref + context。
