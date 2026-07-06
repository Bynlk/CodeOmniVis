# 技术方案设计：feature-002-state-layering

- **对应 spec**：./spec.md
- **版本**：v1

## 方案概述
UI 状态集中到 `src/store/uiStore.ts`。为避免新增运行时依赖并保持零 CDN，采用 **Zustand**（若团队不愿加依赖则退化为 Context + useReducer，接口保持一致）。服务器状态保持 React Query，Cytoscape 保持 ref+context。

## 关键设计
- **UI store 字段**：selectedNodeId、activeTab、searchQuery、isCommandPaletteOpen、isSettingsOpen、（响应式）isMobileDrawerOpen。
- **action**：selectNode、setActiveTab、setSearchQuery、toggleCommandPalette、toggleSettings。
- App.tsx 从 store 读取，移除本地 useState；子组件直接订阅需要的切片，减少 props 透传。
- Cytoscape 实例：保留 CytoscapeContext + cyRef 不动。

## 遵守的技术铁律
- 服务器状态与 UI 状态严格分层。

## 风险与边界
- **时序**：搜索词驱动 visibleNodeIds 的 useMemo 依赖需迁移到 store selector，避免闪烁。

## 任务拆解
- [ ] 建 store/uiStore.ts
- [ ] App.tsx 接入 store，移除本地 UI useState
- [ ] 子组件按需订阅
- [ ] typecheck + test
