# PEV 进度日志

- 2026-07-07：初始化完成。纳管需求文档 frontend-redesign-brief；登记技术栈铁律（前端 React18+Cytoscape+Tailwind；后端硬约束 TSRPC+MongoDB 登记在册，本期不触碰）；依据 9 项设计目标与问题清单拆出 9 个 feature（service-layer / state-layering / design-system / layout-refactor / unified-search / issue-badge / responsive / a11y / performance），全部 spec.md + design.md 就位，状态 todo。
- 2026-07-07：feature-001-service-layer 开发完成。新建 packages/ui/src/services/（client/graph/status/project/ai/index），封装全部 12 个 API 端点为强类型函数（ApiError 保留 status）。改造 useGraph/useStatus/useTrace + 新增 useGraphErrors；重构 Header/SettingsDrawer/AiPanel/TracePanel/StatsPanel/DataFlowPanel/IssuesPanel，消除全部 12 处裸 fetch。补服务层单测 7 条。typecheck 通过、68 个测试全绿。状态 doing，待 /pev-verify。

## 2026-07-07 feature-002-state-layering(开发完成,待验证)
- 新建 `packages/ui/src/store/uiStore.ts`:用模块级 external store + `useSyncExternalStore` 复刻 zustand 的 `useUiStore(selector)` 接口(未新增运行时依赖,零 CDN,支持切片订阅)。字段 selectedNodeId/activeTab/searchQuery/isCommandPaletteOpen/isSettingsOpen/isMobileDrawerOpen;action selectNode/setActiveTab/setSearchQuery/toggleCommandPalette/toggleSettings/toggleMobileDrawer。
- App.tsx 接入 store,移除全部本地 UI useState;visibleNodeIds 的 useMemo 改由 store.searchQuery 驱动;删除 orphaned `useSearch` hook。
- 服务器状态仍归 React Query(useGraph),Cytoscape 仍走 cyRef + CytoscapeContext,未动。
- 新增 `__tests__/store/uiStore.test.ts`(8 项:初始态/各 action/引用不变性)。
- typecheck 通过;vitest 76 passed(含新增 8)。
