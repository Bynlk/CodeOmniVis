# 技术方案设计：feature-004-layout-refactor

- **对应 spec**：./spec.md
- **版本**：v1

## 方案概述
用 CSS grid/flex 构建稳定四区：顶栏（Header）、左侧栏（Sidebar 节点列表）、中央画布（GraphCanvas + 常驻 Legend）、右侧详情（NodeDetailPanel）。分析类面板改为**右侧 dock 或底部可收起面板**，不再 absolute 覆盖画布。

## 关键设计
- **tab 分组（≤4）**：
  1. 图谱（graph，默认）
  2. 分析（filter + dataflow + trace 收进子导航）
  3. 问题（issues，带 badge）
  4. 智能（ai + stats）
- **面板容器**：TabPanel 从 absolute 改为占据独立栅格轨道；打开时画布收窄而非被盖。
- 复用 feature-002 的 uiStore.activeTab。

## 遵守的技术铁律
- 不减功能；Cytoscape 不动。

## 风险与边界
- 画布 resize：面板开合时需触发 cy.resize()，避免布局错乱。

## 任务拆解
- [ ] 设计 grid 骨架替换现有 flex+absolute
- [ ] tab 分组与子导航
- [ ] 面板 dock 化 + cy.resize 联动
- [ ] 测试
