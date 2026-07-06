# 技术方案设计：feature-007-responsive
- **对应 spec**：./spec.md
- **版本**：v1
## 方案概述
基于 feature-004 的 grid 骨架，用 Tailwind 响应式前缀在 ≤768px 折叠侧栏/面板为抽屉（uiStore.isMobileDrawerOpen 控制）。
## 关键设计
- lg：四区并排；md：详情/分析面板可收；sm：Sidebar+面板→抽屉，顶栏保留搜索与菜单按钮。
- 抽屉开合触发 cy.resize()。
## 遵守的技术铁律
- 无外部 CDN。
## 风险与边界
- 画布在断点切换时需 resize，防止 Cytoscape 视口错位。
## 任务拆解
- [ ] 断点样式
- [ ] 抽屉组件与 store 联动
- [ ] cy.resize 联动
- [ ] 测试
