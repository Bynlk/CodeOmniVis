# 技术方案设计：feature-001-service-layer

- **对应 spec**：./spec.md
- **版本**：v1
- **更新时间**：2026-07-07

## 方案概述
新建 `packages/ui/src/services/` 目录，按领域拆分模块，统一封装所有服务器请求。所有组件/hook 改为 import 服务层函数。

## 关键设计
- **目录结构**：
  - `services/client.ts`：底层 `request<T>(url, init)` 封装，统一处理非 2xx（抛 `ApiError`）、JSON 解析、可选 AbortSignal。
  - `services/graph.ts`：`getGraph()`、`getGraphStats()`、`getGraphNodes(type)`、`getGraphDataflow(model?)`、`getGraphErrors()`、`getTrace(nodeId)`。
  - `services/status.ts`：`getStatus()`、`getHealth()`。
  - `services/project.ts`：`postAnalyze()`、`postProject(payload)`。
  - `services/ai.ts`：`postAiChat(payload)`、`postAiExplain(payload)`。
  - `services/index.ts`：re-export。
- **接口 / API**：URL 与 method 逐一对照重构前（见 spec AC2）保持不变。
- **核心流程**：hook（useGraph/useStatus/useTrace）与组件（Header/SettingsDrawer/AiPanel/StatsPanel/DataFlowPanel/IssuesPanel/TracePanel）内的 fetch 逐个替换为服务层调用。
- **依赖**：@codeomnivis/shared 类型；原生 fetch。

## 遵守的技术铁律（constitution）
- 数据契约 100% 兼容（URL/method/body/返回结构不变）。
- 不引入外部 HTTP 库、不引入外部 CDN。

## 风险与边界
- **并发 / 时序**：AiPanel、TracePanel 现有 AbortController 逻辑需保留，封装 request 时透传 signal。
- **边界条件**：既有 `unwrapData`/`readString` 工具对返回包装的处理要保持一致。

## 任务拆解（供 Execute 阶段追踪）
- [ ] 建 services/client.ts + ApiError
- [ ] 建 graph.ts / status.ts / project.ts / ai.ts / index.ts
- [ ] 替换 useGraph.ts、useStatus.ts、useTrace.ts
- [ ] 替换 Header/SettingsDrawer/AiPanel/StatsPanel/DataFlowPanel/IssuesPanel/TracePanel
- [ ] 补 services 单测；跑 typecheck + test
