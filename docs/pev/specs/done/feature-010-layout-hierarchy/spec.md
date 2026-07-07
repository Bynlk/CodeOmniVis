# Spec：feature-010-layout-hierarchy（布局层级重设计 / 消除页面重叠）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G1/G2/G3；对 feature-004 未竟缺口的补完）
- **创建时间**：2026-07-07
- **关系**：见 ADR 0003。本 feature 补完 feature-004「四区栅格」中未真正入栅格的详情面板，并新增 z-index 治理与浮层仲裁；不回退 feature-004 的 dock 化与 feature-007 的响应式类。

## 背景（用户实测反馈）
用户报告：不同「页面」（面板）经常重叠、层级混乱、观感差。代码核查确认为结构性缺陷：
1. 详情面板 NodeDetailPanel 用 absolute 浮层（z-20），与 TabPanel dock（md:static 栅格轨道）范式冲突——先开分析面板再点节点时，详情浮层盖在 dock 之上，两块内容重叠。
2. 详情面板 absolute top-0 bottom-0 的定位锚点是视口（父容器无 relative），导致其顶边压住 Header。
3. z-10/20/30/40/50 魔法值散落 6 个文件，z-50 被 modal / drawer / tooltip 三者共用，无集中治理。
4. 移动抽屉与模态之间无互斥，遮罩可叠遮罩；模态打开时 NodeTooltip 仍会浮出盖住模态。

## 验收标准（Acceptance Criteria）

- **AC1（详情面板入栅格，不再浮层压 Header）**
  - Given：主内容区
  - When：选中一个节点打开 NodeDetailPanel
  - Then：详情面板作为主区栅格中的一条轨道（或锚定到带 relative 的主区容器），**不使用相对视口的 absolute 定位**，其顶边不越过/覆盖 Header；typecheck 与渲染测试可断言其不含相对视口的 fixed/absolute-to-viewport 定位。

- **AC2（详情面板与分析 dock 不重叠：二者互斥）**
  - Given：某分析/工具面板（filter/dataflow/trace/issues/ai/stats 任一）已在 dock 打开
  - When：用户选中一个节点（请求打开详情）
  - Then：系统只呈现其一——打开详情时自动收起分析 dock（activeTab→null），反之打开分析 dock 时自动关闭详情（selectedNode→null）；任一时刻右侧不同时并存两块相互覆盖的面板。

- **AC3（z-index 语义化，tooltip 低于 modal）**
  - Given：全站层叠元素
  - When：查看各元素的 z 值来源
  - Then：z 值取自 tailwind 中一套语义 token（如 z-base/z-canvas-ui/z-panel/z-drawer/z-modal/z-tooltip），组件内不再出现散落的 z-10/20/30/40/50 数字类；**tooltip 的层级严格低于 modal**（模态打开时 tooltip 不会盖在其上）。

- **AC4（单一浮层仲裁）**
  - Given：CommandPalette、SettingsDrawer、移动端 Sidebar 抽屉、分析 dock 属于互斥浮层
  - When：打开其中一个
  - Then：其余互斥浮层被自动收起，同一时刻至多一个「模态级」浮层持有遮罩；打开模态（Cmd+K / 设置）时抑制 NodeTooltip 显示。

- **AC5（回归门禁）**
  - Given：以上改造
  - When：typecheck + 全量 test + production build
  - Then：全部通过；feature-004 的 dock 行为、feature-007 的响应式类（NodeDetailPanel 的 w-full/max-w-sm/sm:w-80、移动抽屉）不被回退；功能面板数量不减。

## Non-Goals
- 不改视觉皮肤 / 不换图标系统 / 不引入新配色（那是另一件事，属视觉刷新）。
- 不改数据契约、不动 services/、不动 Cytoscape 渲染算法。
- 不新增 npm 依赖（浮层仲裁复用现有 uiStore）。

## 开发偏好
- 测试：SSR 静态渲染断言 + 结构断言（禁止起本地服务，沿用既有 renderToStaticMarkup 方式）：
  - 断言主区容器采用栅格且详情面板不再相对视口定位；
  - 断言浮层仲裁：打开详情后 activeTab 归 null（及反向）；
  - 断言语义 z token 类存在、tooltip token 数值 < modal token 数值。
- 交付节奏：一次性完成，改动集中在 App.tsx / NodeDetailPanel / TabPanel / uiStore / tailwind.config / NodeTooltip。

## 遗留问题 / 待确认
- 详情与分析 dock 采「互斥」而非「双轨并存」——已在 AC2 定死为互斥（更契合 G1/G2 主次分明）。
