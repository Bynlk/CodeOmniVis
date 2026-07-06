# PEV 进度日志

- 2026-07-07：初始化完成。纳管需求文档 frontend-redesign-brief；登记技术栈铁律（前端 React18+Cytoscape+Tailwind；后端硬约束 TSRPC+MongoDB 登记在册，本期不触碰）；依据 9 项设计目标与问题清单拆出 9 个 feature（service-layer / state-layering / design-system / layout-refactor / unified-search / issue-badge / responsive / a11y / performance），全部 spec.md + design.md 就位，状态 todo。
- 2026-07-07：feature-001-service-layer 开发完成。新建 packages/ui/src/services/（client/graph/status/project/ai/index），封装全部 12 个 API 端点为强类型函数（ApiError 保留 status）。改造 useGraph/useStatus/useTrace + 新增 useGraphErrors；重构 Header/SettingsDrawer/AiPanel/TracePanel/StatsPanel/DataFlowPanel/IssuesPanel，消除全部 12 处裸 fetch。补服务层单测 7 条。typecheck 通过、68 个测试全绿。状态 doing，待 /pev-verify。

## 2026-07-07 feature-002-state-layering(开发完成,待验证)
- 新建 `packages/ui/src/store/uiStore.ts`:用模块级 external store + `useSyncExternalStore` 复刻 zustand 的 `useUiStore(selector)` 接口(未新增运行时依赖,零 CDN,支持切片订阅)。字段 selectedNodeId/activeTab/searchQuery/isCommandPaletteOpen/isSettingsOpen/isMobileDrawerOpen;action selectNode/setActiveTab/setSearchQuery/toggleCommandPalette/toggleSettings/toggleMobileDrawer。
- App.tsx 接入 store,移除全部本地 UI useState;visibleNodeIds 的 useMemo 改由 store.searchQuery 驱动;删除 orphaned `useSearch` hook。
- 服务器状态仍归 React Query(useGraph),Cytoscape 仍走 cyRef + CytoscapeContext,未动。
- 新增 `__tests__/store/uiStore.test.ts`(8 项:初始态/各 action/引用不变性)。
- typecheck 通过;vitest 76 passed(含新增 8)。

## 2026-07-07 feature-003-design-system(开发完成,待验证)
- 扩展 `tailwind.config.js`:node 语义色 token(17 种,镜像 shared 的 NODE_COLORS 同值)+ 统一 spacing/borderRadius/fontSize/boxShadow scale。
- 新建 `components/Legend.tsx`:常驻画布左下角,颜色 + emoji 直接读 `nodeConfig`(与 Cytoscape 同源),默认展开、可折叠;折叠态入 uiStore 并持久化 localStorage(key codeomnivis-legend-collapsed);仅显示图谱实际出现的节点类型。
- uiStore 增 `isLegendCollapsed` 字段 + `toggleLegend` action(带 localStorage 读写)。
- 补齐 5 个 kotlin nodeType i18n 与 legend.* 文案(zh-CN / en-US)。
- 新增 ADR `decisions/0002-节点配色单一真源.md`:brief 试探色板与画布实际 NODE_COLORS 冲突,裁定以 NODE_COLORS 为唯一真源(图例=画布 100% 一致),覆盖全部 17 种。
- 新增 `__tests__/components/Legend.test.tsx`(3 项:存在性 / swatch 颜色单一真源一致 / 折叠态隐藏列表)。
- typecheck 通过;vitest 79 passed(含新增 3);vite 生产构建通过,主 chunk 78.14KB(gzip 23.34KB)。

## 2026-07-07 feature-004-layout-refactor(开发完成,待验证)
- 顶层 tab 从 7 个精简为 4 个分组(tabGroups.ts):图谱 / 分析[filter+dataflow+trace] / 问题[issues,带 badge] / 智能[ai+stats];不删功能仅归类。
- TabPanel 从 `absolute` 覆盖画布改为 `<aside>` dock(右侧独立栅格轨道,w-96 max-40%),面板打开时画布收窄而非被盖(AC1);面板头含分组标题+关闭,多子 tab 时渲染子导航。
- TabBar 重写为分组导航;App.tsx 主区改为 flex 四区(顶栏/侧栏/画布 min-w-0/详情),TabPanel 移出 main 作为 dock 兄弟节点。
- GraphCanvas 增 ResizeObserver + rAF 去抖调用 cy.resize(),面板开合时同步视口(AC1 风险项)。
- 补 group.* / panel.close i18n(zh/en)。
- 新增 `__tests__/components/layout.test.tsx`(7 项:分组≤4 / label / badge / 叶子归组 / dock 非 absolute / 关闭 / 子导航)。
- typecheck 通过;vitest 86 passed(含新增 7);生产构建通过(主 chunk 80.39KB,略超 80KB 目标,留待 feature-009 懒加载优化)。

## 2026-07-07 feature-005-unified-search(开发完成,待验证)
- CommandPalette 移除内联重复过滤逻辑,改用唯一索引函数 `filterNodesByQuery`(与 Header 过滤同源,AC1)。
- searchQuery 单一真源已在 feature-002 收敛到 uiStore;Header 输入 → setSearchQuery 驱动侧栏/画布可见节点;Cmd+K 面板用瞬态输入做快速跳转,选中即 selectNode+聚焦,二者职责分离不互相清空(AC2)。
- 新增 `selectVisibleNodeIds` selector(searchNodes.ts),App 的 visibleNodeIds 派生迁移至该 selector(可见性单一真源、可单测)。
- 新增 4 项 selectVisibleNodeIds 单测;既有 filterNodesByQuery 测试无回归。
- typecheck 通过;vitest 90 passed。
- 2026-07-07 feature-006-issue-badge 实现完成（commit b0d8a57）：问题 tab 徽标接入 /api/graph/errors 真实数量（替换硬编码 0，为 0 时隐藏）；uiStore 新增 wsStatus 并由 useWebSocket 消费 isConnected（600ms 防抖）；Header 新增 WsStatusIndicator 连接状态灯（绿/灰/黄 + i18n）。typecheck ✅ / 98 tests ✅ / build ✅（主 chunk 81.35KB，≤80KB 目标留待 feature-009 懒加载）。待 /pev-verify。
- 2026-07-07 feature-006-issue-badge 通过独立子代理验证(AC1/AC2/AC3 全 ✅,无越界),已归档至 specs/done/,状态置 done。

## 2026-07-07 feature-007-responsive(开发完成,待验证)
- Header 增移动端 ☰ 菜单按钮(md:hidden)唤出 Sidebar 抽屉;搜索框断点宽度 w-36/sm:48/md:64。
- Sidebar 拆桌面/移动两态:桌面(≥md)常驻可折叠;移动(<md)为 off-canvas 抽屉(fixed,role=dialog,遮罩,translate-x-0/-translate-x-full 由 uiStore.isMobileDrawerOpen 控制;点节点即 onNodeSelect + 关抽屉)。renderNodeList 抽公用避免重复。
- TabPanel 移动态改 fixed inset-y-0 right-0 全屏覆盖+遮罩,桌面态 md:static/md:w-96/md:max-w-[40%] 回落 dock,画布不被挤压。
- 补 menu.open/close、drawer.close、sidebar.expand/collapse i18n(zh/en)。
- 新增 __tests__/components/responsive.test.tsx(3 项:桌面/移动两套渲染 / 抽屉开合 store 联动 / TabPanel fixed↔md:static)。
- typecheck 通过;vitest 101 passed(含新增 3);vite build 通过,主 chunk 83.37KB(gzip 24.65KB,略超 80KB 目标,留待 feature-009 懒加载)。待 /pev-verify。
- 2026-07-07 feature-007-responsive 独立核验通过(AC1/AC2/AC3):补 NodeDetailPanel w-full/max-w-sm sm:w-80 防移动端溢出+role=complementary;三档关键操作(搜索/tab/图例/节点选择/抽屉)可达;101 测试+typecheck+build 通过。视觉档因 <network_security> 禁止起本地服务,改由 SSR 断点标记测试+生产构建覆盖,已记录。归档至 specs/done,状态置 done。
