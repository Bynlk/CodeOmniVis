# 技术方案设计：feature-010-layout-hierarchy

- **对应 spec**：./spec.md
- **版本**：v1

## 方案概述
把主内容区从「flex + 若干 absolute 浮层」改造为一套**显式 CSS Grid 三轨** `[sidebar | canvas | rightdock]`，并把详情面板与分析面板都收进最右侧的 `rightdock` 轨道（互斥占用）。z-index 收敛为一套 tailwind 语义 token。新增 uiStore 浮层仲裁，保证同一时刻只有一个模态级浮层。

## 关键设计

### 1. 主区 CSS Grid 三轨（App.tsx）
- 现状：`<div className="flex flex-1 overflow-hidden">`，Sidebar/main flex，TabPanel md:static，NodeDetailPanel absolute。
- 目标：主区用 grid，列轨道随状态变化：
  - 无 dock、无详情：`grid-cols-[auto_1fr]`（侧栏 + 画布）
  - 有 dock 或有详情（互斥，二者只会有其一）：`grid-cols-[auto_1fr_auto]`（侧栏 + 画布 + 右轨）
- 画布始终占 `1fr`，右轨 `auto`（内部面板自带宽度 md:w-96 / detail md:w-80）。GraphCanvas 的 ResizeObserver→cy.resize 已就位（feature-004），轨道宽度变化会自动触发。
- `<main>` 保留 `relative`（Legend 锚点）；右轨容器本身即栅格 item，不再 absolute。

### 2. 详情面板归位（NodeDetailPanel.tsx）
- 去掉 `absolute right-0 top-0 bottom-0 z-20`；改为普通块级，由父栅格 item 决定位置。
- 保留 feature-007 响应式：桌面 `md:w-80`，窄屏 `w-full max-w-sm`（<md 时右轨占满或抽屉化，与 TabPanel 移动策略一致）。
- 移动端（<md）：详情面板与分析面板一样，采用 `fixed inset-y-0 right-0 z-drawer` 抽屉 + 遮罩（复用同一范式），桌面才进栅格轨道。

### 3. 互斥仲裁（uiStore.ts）—— AC2 / AC4
新增「打开即互斥」的 action 语义，不新增依赖：
- `selectNode(id)`：当 id 非 null 时，同时 `activeTab=null`（收起分析 dock）。
- `setActiveTab(tab)`：当 tab 非 null 时，同时 `selectedNodeId=null`（关闭详情）。
- `toggleCommandPalette(true)` / `toggleSettings(true)` / `toggleMobileDrawer(true)`：打开任一模态级浮层时，关闭其他模态级浮层（Cmd+K / Settings / 移动抽屉三者互斥）。
- 新增派生 `isAnyModalOpen = isCommandPaletteOpen || isSettingsOpen`，供 NodeTooltip 抑制使用。
- 实现方式：在各 action 的 setState patch 里合并互斥字段；集中在一处，附注释说明「布局仲裁（feature-010）」。

### 4. z-index 语义 token（tailwind.config.js）—— AC3
在 theme.extend.zIndex 定义：
```
zIndex: {
  'base': '0',
  'canvas-ui': '10',   // Legend、画布内浮标
  'panel': '20',       // 右轨面板（详情 / 分析在栅格内一般无需 z，仅移动抽屉用）
  'drawer': '40',      // 移动端抽屉 + 其遮罩
  'modal': '50',       // CommandPalette / SettingsDrawer
  'tooltip': '45',     // NodeTooltip —— 高于 drawer 但【低于 modal】
}
```
- 全站把 `z-10/20/30/40/50` 替换成 `z-canvas-ui / z-panel / z-drawer / z-modal / z-tooltip`。
- 关键：`tooltip(45) < modal(50)`，模态打开时 tooltip 不会压上去；且 NodeTooltip 额外在 `isAnyModalOpen` 时直接不渲染（双保险，AC4）。

### 5. Tooltip 抑制（NodeTooltip.tsx）—— AC4
- 订阅 `isAnyModalOpen`；为 true 时 `return null`（并清理 timer），模态期间不弹 tooltip。

## 遵守的技术铁律
- 不减功能、不动 Cytoscape 渲染、不动 services/、不加依赖、无外部 CDN、无炫技动画。
- 复用 feature-002 uiStore、feature-004 dock、feature-007 响应式类。

## 风险与边界
- 互斥可能与用户预期「详情+分析并看」相悖 —— 已在 spec AC2 明确取互斥（主次分明优先）。若日后要并存，再开新 ADR。
- Grid 列模板随状态切换时画布宽度跳变 —— 由既有 cy.resize 联动吸收，无需动画。
- SSR 测试无法测真实层叠，改为断言「类名/结构/store 仲裁行为」。

## 任务拆解
- [ ] tailwind zIndex token
- [ ] uiStore 互斥仲裁 + isAnyModalOpen
- [ ] App.tsx 主区 grid 三轨 + 详情入右轨
- [ ] NodeDetailPanel 去 absolute-to-viewport + 保留响应式
- [ ] NodeTooltip 模态抑制 + z token
- [ ] 全站 z 魔法值替换
- [ ] 布局/仲裁测试 + 全量门禁
