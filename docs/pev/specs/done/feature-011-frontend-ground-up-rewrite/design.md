# feature-011 设计文档(表现层从 0 重写)

## 1. 总体策略:保留数据管线,推倒表现层

本次重写严格区分三个同心层:

```
● 契约层(LOCKED)      packages/shared 类型 + 12 server API
● 数据管线层(REUSE)   services/ + hooks/ + utils/graphTransform + lib/{nodeConfig,edgeConfig,i18n,*Context}
● 表现层(REBUILD)      App 外壳 + 布局系统 + 全部可视组件 + 样式/token
```

重写只发生在表现层。数据管线层已经在 feature-001/002 做到 brief G7/G8/G10 要求，本轮只重接线不重写，以保证契约 100% 兼容。

## 2. 新设计系统地基

### 2.1 index.css 重写（除锈）
- 删除暴力 `* { margin:0;padding:0;box-sizing }`（brief N2），改用 Tailwind preflight + 有限定制。
- 保留：focus-visible 描边、prefers-reduced-motion 关动画、sr-only。
- 新增 CSS 变量层（:root）作为设计语义变量，供运行时主题（背景/表面/边框/文本层级）。

### 2.2 tailwind.config 扩展（不破坏单一真源）
- 保留 node.* 颜色（镜像 shared NODE_COLORS，ADR-0002）、primary 蓝色阶、spacing/radius/fontSize/shadow/zIndex 语义 token。
- 新增：surface / surface-raised / border-subtle 等语义颜色别名，映射到 CSS 变量。
- z-index 语义分层保持：base:0, canvas-ui:10, panel:20, drawer:40, tooltip:45, modal:50。

## 3. AppShell 布局架构

### 3.1 CSS Grid 语义分区（桌面）
```
grid-template-areas:
  "header header"
  "sidebar main"
grid-template-rows:    auto 1fr
grid-template-columns: <sidebar-track> 1fr
```
- Header 跨全宽，永远可见（sticky top，z=panel）。
- Sidebar 左轨：桌面常驻（可折叠），<=768px 变 overlay 抽屉。
- main 主区：GraphCanvas 铺满，图例固定在画布内左下角（z=canvas-ui）。
- 右侧详情/面板：用 CSS Grid 右轨占位（而非 absolute 遮盖），仅在 selectedNode 或 activeTab 时出现。
- 移动端右面板降级为底部抽屉/全屏。

### 3.2 z-index 分层与浮层仲裁
- 模态（CommandPalette / SettingsDrawer）z=modal，inset-0 遮罩。
- selectIsAnyModalOpen 为 true 时抑制 NodeTooltip（brief M8）。
- 面板与详情同时只能一者占右轨（uiStore selectNode/setActiveTab 互斥，feature-010 已立规则，重写时保留）。

### 3.3 响应式断点
- lg（>=1024）：Sidebar 常驻 + 右轨并列。
- md（768-1023）：Sidebar 可折叠，右轨变窄。
- sm（<768）：Sidebar 抽屉化（hamburger），右面板全屏/底部抽屉，Tab 横向滑动。

## 4. 组件树（全重写）

```
App (仅布局编排+接线, 无业务 state)
└ AppShell
  ├ Header            品牌 + 统一搜索入口 + WsStatusIndicator + FreshnessBadge + LangToggle + 设置 + 刷新
  ├ Sidebar           节点列表(按类型分组+搜索高亮) + 内嵌/链接 Legend
  ├ MainCanvas
  │  ├ GraphCanvas     复用 cytoscape 接线(context/transform/config)
  │  ├ Legend          常驻图例(NodeType 17 + EdgeType 15)
  │  └ NodeTooltip     hover, 模态打开时抑制
  ├ RightRegion       selectedNode → NodeDetailPanel; activeTab → TabPanel
  │  ├ NodeDetailPanel 基本信息 + 入/出边 + 跳定义
  │  └ TabPanel        按分组懒加载面板
  ├ CommandPalette    ⌘K 统一搜索(共享 uiStore.searchQuery)
  └ SettingsDrawer    AI/项目/语言/关于(分组)
```

### 4.1 Tab 分组 <= 4（brief §7-7）
保持 feature 已有的 4 分组结构（graph/analysis/issues/intelligence），但面板 UI 从 0 重写：
- graph：纯画布（activeTab=null）。
- analysis：filter + dataflow + trace。
- issues：问题列表（badge 接 /api/graph/errors 真实数）。
- intelligence：ai + stats。

### 4.2 搜索合一（brief G3）
Header 搜索框与 CommandPalette 共享 uiStore.searchQuery，同一 filterNodesByQuery/selectVisibleNodeIds 算法，结果驱动画高亮 + 定位。

### 4.3 Badge 接真实数据（brief C2）
issues badge = useGraphErrors() 中 severity==='error' 的数量，非 0 才红。

### 4.4 WebSocket 状态可见（brief C3）
WsStatusIndicator 读 uiStore.wsStatus（useWebSocket 写入），connecting/connected/reconnecting/error 四态小灯。

## 5. 状态分层（brief G8/G10）
- 服务端状态：React Query（useGraph/useStatus/useGraphErrors/useTrace）。
- UI 状态：uiStore（useSyncExternalStore，无依赖）——selectedNodeId/activeTab/searchQuery/三模态开关/isLegendCollapsed/wsStatus。
- 图交互状态：cyRef + CytoscapeContext + SelectionContext。
- App 不再持有 7 个 useState；只订阅 uiStore 与 query 做布局编排。

## 6. 测试策略（无本地 server）
- 组件测试用 SSR renderToStaticMarkup 断言关键语义（存在性 + a11y role/aria + 图例存在 + Tab 分组数）。
- 保留 services/hooks/store 的单元测试；新建布局层级与仲裁测试。
- 禁止启动 dev/preview server。

## 7. 实施顺序
1. 地基：index.css + tailwind token（task 19）。
2. AppShell + 布局系统 + z 分层 + 响应式（task 20）。
3. 全部可视组件重写（task 21）。
4. 测试适配 + 全量门禁（task 22）。
5. 独立验证 + 归档 + 提交（task 23）。
