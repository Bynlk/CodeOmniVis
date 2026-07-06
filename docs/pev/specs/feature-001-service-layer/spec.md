# Spec：feature-001-service-layer（统一 API 服务层）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：docs/pev/managed/requirements/frontend-redesign-brief_v1.md（C4、G7）
- **创建时间**：2026-07-07

## 一句话目标
把散落在 6+ 个 UI 文件里的 12 处 `fetch` 收敛到统一的 `packages/ui/src/services/` 服务层，成为唯一的服务器数据入口。

## 验收标准（Acceptance Criteria）

- **AC1**
  - 前提（Given）：`packages/ui/src/services/` 目录已建立
  - 操作（When）：检索整个 `packages/ui/src`（services 目录除外）中的 `fetch(` 调用
  - 期望（Then）：组件与 hook 中不再出现任何裸 `fetch(`，全部经由 services 层封装函数发起
- **AC2**
  - 前提（Given）：服务层封装了全部 12 个既有 API 端点
  - 操作（When）：调用任一封装函数（如 `getGraph()`、`getGraphErrors()`、`postAnalyze()`）
  - 期望（Then）：请求 URL、method、body 与重构前 100% 一致，返回类型强类型化（引用 @codeomnivis/shared 的 OmniGraph 等类型），HTTP 非 2xx 抛出统一的错误对象
- **AC3**
  - 前提（Given）：服务层就位
  - 操作（When）：运行 `pnpm --filter @codeomnivis/ui typecheck` 与 `pnpm --filter @codeomnivis/ui test`
  - 期望（Then）：类型检查通过，既有测试全部通过（数据契约未破坏）

## Non-Goals（明确不做）
- 本期不做：改动服务器端任何接口的路径、参数或返回结构。
- 本期不做：引入 axios 等新 HTTP 库（用原生 fetch 封装即可）。
- 本期不做：把 WebSocket 逻辑并入本服务层（WS 属 feature-006 与既有 useWebSocket）。

## 开发偏好
- 测试要求：为 services 层核心函数补最小单测（URL/method 正确性），既有测试保持通过。
- 交付节奏：作为其它 feature 的地基，最先交付。

## 遗留问题 / 待确认
- 无。
