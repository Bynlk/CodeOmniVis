# 技术方案设计：feature-008-a11y
- **对应 spec**：./spec.md
- **版本**：v1
## 方案概述
系统性补 semantic HTML（nav/main/aside/section）、role/aria-label、focus 管理（模态 trap、Esc 关闭）、focus-visible 样式、对比度调整。
## 关键设计
- 图标按钮统一 aria-label（i18n）。
- CommandPalette/SettingsDrawer 焦点陷阱 + Esc 关闭 + 返回触发元素。
- 节点列表方向键导航；tab 用 role=tablist/tab/tabpanel。
- Tailwind focus-visible ring token。
## 遵守的技术铁律
- 无外部 CDN。
## 风险与边界
- Cytoscape 画布本身键盘可达性有限，提供列表/搜索作为等价可达路径。
## 任务拆解
- [ ] 语义标签与 landmark
- [ ] aria-label / role
- [ ] 焦点管理与 focus ring
- [ ] 对比度校正
- [ ] 审计并记录分数
