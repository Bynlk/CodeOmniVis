# Spec：feature-003-design-system（设计系统 + 强制图例）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G4 强制图例、视觉 token、非协商项 1/2）
- **创建时间**：2026-07-07

## 一句话目标
建立统一的设计 token（颜色/间距/字号/圆角/阴影）与组件基元，并新增**常驻可见的图例（Legend）**，让用户 3 秒内理解节点/边配色含义。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：视觉 token 分散、无统一规范
  - When：审阅 tailwind.config.js 与 index.css
  - Then：节点类型色板固化为 token（page=#8b5cf6, component=#06b6d4, api=#10b981, handler=#f59e0b, service=#ef4444, db=#ec4899），间距/圆角/字号有统一 scale，供全站复用
- **AC2**
  - Given：画布上无图例，用户不懂配色
  - When：打开可视化页面
  - Then：页面上**常驻**一个图例组件（可折叠但默认可见），列出各节点类型的颜色+emoji+名称，配色与 Cytoscape 实际渲染一致（引用同一 nodeConfig 源）
- **AC3**
  - Given：设计系统落地
  - When：typecheck + test + 目测三种断点
  - Then：通过，视觉统一无杂色

## Non-Goals
- 本期不做：更换图渲染引擎或引入动画特效（非协商项：禁止炫技动画）。
- 本期不做：改变节点类型的语义或数量（17 种不变）。

## 开发偏好
- 测试要求：Legend 至少覆盖快照/存在性测试。
- 交付节奏：作为视觉基座，早于布局重构。

## 遗留问题 / 待确认
- 图例默认展开还是折叠：design 固定为「默认展开、可折叠、状态记忆」。
