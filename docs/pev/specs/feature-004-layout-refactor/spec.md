# Spec：feature-004-layout-refactor（布局层级与信息架构重构）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G1/G2、非协商项 3/7、M-系列）
- **创建时间**：2026-07-07

## 一句话目标
重构主界面布局层级：Tab 面板不再绝对定位覆盖画布，tab 精简/分组到 ≤4 个主类，建立清晰的顶栏/侧栏/画布/详情四区栅格。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：当前 TabPanel 以 absolute 覆盖在 GraphCanvas 上方（遮挡画布）
  - When：切换任一 tab 面板
  - Then：面板以独立布局区（侧/底 dock 或分栏）呈现，**不遮挡**画布主体，画布可见区不被压没
- **AC2**
  - Given：当前有 7 个 tab（graph/filter/issues/dataflow/trace/ai/stats）
  - When：查看 tab 栏
  - Then：主 tab 精简/分组为 **≤4** 个（如：图谱 / 分析[filter+dataflow+trace] / 问题[issues] / 智能[ai+stats]，具体分组在 design 固定），信息层级清晰
- **AC3**
  - Given：布局重构
  - When：typecheck + test + 目测
  - Then：通过，四区（顶栏/侧栏/画布/详情）职责清晰，无重叠错位

## Non-Goals
- 本期不做：删除任何现有功能面板（只是重新归类，不减功能）。
- 本期不做：响应式移动端抽屉（属 feature-007）。

## 开发偏好
- 测试要求：关键布局组件渲染测试。
- 交付节奏：依赖 feature-002/003。

## 遗留问题 / 待确认
- tab 分组方案在 design.md 固定。
