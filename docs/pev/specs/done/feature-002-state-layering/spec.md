# Spec：feature-002-state-layering（状态分层）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G8、M-系列）
- **创建时间**：2026-07-07

## 一句话目标
明确区分服务器状态（React Query）、UI 状态（选中/激活 tab/搜索词，用轻量 store）、Cytoscape 实例（ref+context），消除 App.tsx 里混杂的 useState 泥团。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：App.tsx 当前用多个散落 useState 管理 selectedNode/activeTab/搜索等 UI 状态
  - When：重构后审阅状态归属
  - Then：服务器数据只来自 React Query hooks；UI 状态集中到一个可复用的 store（Zustand 或 Context+reducer 二选一，需在 design 固化）；Cytoscape 实例仍走 ref+context
- **AC2**
  - Given：状态分层完成
  - When：选中节点、切换 tab、输入搜索
  - Then：交互行为与重构前一致，无回归；跨组件读取 UI 状态不再靠层层 props 透传
- **AC3**
  - Given：重构完成
  - When：typecheck + test
  - Then：通过

## Non-Goals
- 本期不做：把服务器数据也塞进 UI store（服务器数据只归 React Query）。
- 本期不做：引入 redux 等重型状态库。

## 开发偏好
- 测试要求：store 的关键 action 补最小单测。
- 交付节奏：紧随 feature-001。

## 遗留问题 / 待确认
- store 选型（Zustand vs Context+reducer）在 design.md 固定为 Zustand（体积小、无 provider 嵌套），若不新增依赖则用 Context+useReducer 兜底。
