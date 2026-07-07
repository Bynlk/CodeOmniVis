# feature-011 前端表现层从 0 重写(ground-up rewrite)

## 背景与动机

用户明确否定了 feature-004 / feature-010 采取的「增量补丁」路线,判定为「偷懒」,要求
**「从 0 开始重新写前端页面」**。因此本 feature 不是再打补丁,而是把整个**表现层**推倒重建。

现状痛点(见 brief §1/§2):App.tsx 是「状态中心 + 布局编排 + 事件总线」三合一巨组件;
7 个 Tab 信息过载;两个浮层争抢主画布;图例缺失;顶栏搜索与 ⌘K 双轨;移动端不可用;
可访问性全缺。这些是表现层的结构性问题,只有重写才能根治。

## 范围边界(硬约束)

### 不可动 / 必须 100% 兼容(动了 serve 会崩)
- packages/shared 数据契约:OmniGraph / 17 NodeType / 15 EdgeType / TraceResult / Stats / DataFlow。
- 12 个 server API(brief §4)的调用方式、路径、请求体、响应结构。
- 技术栈(brief §8 constitution):React 18 + TS、Cytoscape 3 + dagre、Tailwind 3、原生 WebSocket、Vite 5、i18next、@tanstack/react-query、pnpm + Turborepo。

### 数据层保留接线(健康,继续用,不重写)
- services/(client/graph/ai/project/status):API 解耦层,brief G7 已达成。
- hooks/(useGraph/useStatus/useGraphErrors/useTrace/useWebSocket/websocketController):服务端状态层。
- utils/graphTransform.ts:Graph→Cytoscape 元素转换。
- lib/nodeConfig.ts / lib/edgeConfig.ts:配色/emoji 单一真源(ADR-0002)。
- lib/i18n.ts、locales/*.json:国际化基础设施(文案可增补)。
- lib/cytoscapeContext.ts / lib/selectionContext.ts:图交互状态载体。
- services 与 hooks 的既有测试保持绿。

### 从 0 推倒重建的「前端页面」(表现层)
- App 外壳:拆掉「状态中心」App.tsx,只留布局编排 + 接线。
- 布局系统:全新 AppShell,CSS Grid 语义分区,z-index 固定分层,浮层不穿透,响应式。
- 全部可视组件:Header、Sidebar、Legend、NodeDetailPanel、CommandPalette、Tab 面板组、SettingsDrawer、Tooltip、WsStatusIndicator、FreshnessBadge 等——不复用旧组件代码,基于保留的 services/hooks/契约重写。
- 设计 token / 样式:重写 index.css(去掉暴力 * reset),扩展 tailwind token 层。
- 状态接线:UI 状态走 uiStore,服务端状态走 React Query,图状态走 ref+context,三层清晰。

## 验收标准(Given/When/Then)

对齐 brief §9 的 7 个自检问题(全「是」才算交付)+ §0 的 G1-G9。

### AC-1(brief §9-Q1,G1):5 秒看懂项目
- Given 用户首次进入应用且 /api/graph、/api/graph/stats、/api/graph/errors 有数据
- When 页面首屏渲染完成
- Then 首屏同时可见:① 主画布(分层结构)② 常驻图例(层/类型颜色)③ 问题数 Badge(真实非硬编码)④ 项目概览统计。无需任何点击即可回答「有哪些层、有哪些问题」。

### AC-2(brief §9-Q2,G1):节点→详情最短路径
- Given 主画布已渲染节点
- When 用户单击任意节点
- Then 右侧详情面板出现,展示 基本信息 + 入/出边 + 跳定义文件入口;从「看到节点」到「看到详情+上下游」<= 2 步(单击即出)。

### AC-3(brief §9-Q3,G4,brief §7-2):图例常驻
- Given 应用任意主界面状态
- When 用户不做任何操作
- Then 17 种 NodeType 与 15 种 EdgeType 的 颜色 + emoji + 名称 图例常驻可见(或一键展开且默认暴露),颜色源自 nodeConfig/edgeConfig 单一真源。

### AC-4(brief §9-Q4,G2,brief §7-7):Tab<=4 且层级分明
- Given 重写后的信息架构
- When 统计顶层 Tab / 功能分组入口
- Then 顶层 Tab 分组数 <= 4;Header / Sidebar / 画布 / 面板 视觉层级分明,主画布是绝对焦点;z-index 固定分层,浮层遮罩不穿透(打开模态时 tooltip 被抑制)。

### AC-5(brief §9-Q5,G5,brief §7-8):移动端可用
- Given 视口宽度 375px
- When 用户访问应用
- Then Sidebar 抽屉化(hamburger 触发 overlay),主画布可用,面板降级为抽屉/全屏,无横向溢出;sm/md/lg 三断点均有合理布局。

### AC-6(brief §9-Q6,G6):键盘全可达
- Given 用户仅用 Tab / Enter / Esc
- When 执行核心工作流(搜索节点→选中→看详情→关闭)
- Then 全流程键盘可完成;ARIA 完整(role/aria-label/landmark);焦点管理正确(模态打开锁焦、关闭复位);动画可通过 prefers-reduced-motion 关闭。

### AC-7(brief §9-Q7,G9):性能达标
- Given 生产构建产物
- When 度量 chunk 体积
- Then main chunk <= 80KB;vendor-react 单块无循环依赖;首屏关键渲染路径不被大包阻塞。

### AC-8(G3,brief §7-4):搜索合一
- Given 顶栏搜索与 ⌘K 命令面板
- When 用户在任一入口输入 query
- Then 两者共享同一 query state(uiStore.searchQuery)与同一过滤算法(searchNodes),结果一致,支持「跳图 + 高亮 + 定位」。

### AC-9(数据契约兼容,brief §3/§4):契约零回归
- Given 重写后的表现层
- When 运行 pnpm tsc --noEmit、pnpm test、生产构建
- Then 全绿;不修改 packages/shared 任何类型;12 个 API 调用签名不变;所有对 server 的数据读写仍走保留的 services 层(UI 内零裸 fetch)。

## Non-Goals(明确不做)
- 不改后端(TSRPC/MongoDB)、不改 server 路由与响应结构。
- 不改数据契约类型定义。
- 不替换技术栈(不引入新框架/新渲染器/新状态库依赖)。
- 不做炫技动画;Cytoscape 不用 remove+add 暴力刷图。
- 不新增 server API,不改变现有 API 的请求/响应形状。

## 门禁(交付前必须全绿)
1. pnpm --filter @codeomnivis/ui exec tsc --noEmit 退出码 0。
2. pnpm --filter @codeomnivis/ui test 全通过。
3. 生产构建成功,main chunk <= 80KB。
4. 独立验证 agent(不看开发对话)对照本 spec 判卷,AC-1..AC-9 全 PASS。
5. 全程不启动任何本地/dev/preview server(测试用 SSR renderToStaticMarkup)。
