# 技术方案设计：feature-005-unified-search

- **对应 spec**：./spec.md
- **版本**：v1

## 方案概述
搜索词收敛到 uiStore.searchQuery；useSearch 作为唯一索引 hook 被 Header 与 CommandPalette 复用。

## 关键设计
- Header 输入框 onChange → uiStore.setSearchQuery。
- CommandPalette 读取同一 searchQuery（或独立即时输入但共用 searchNodes 索引函数），选中即 selectNode+聚焦。
- visibleNodeIds 派生逻辑从 App 迁到 selector。

## 遵守的技术铁律
- 单一真源。

## 风险与边界
- Cmd+K 面板输入与 Header 输入的“聚焦 vs 过滤”职责需明确，避免互相清空。

## 任务拆解
- [ ] searchQuery 入 store
- [ ] Header/CommandPalette 复用同一索引
- [ ] visibleNodeIds selector 化
- [ ] 测试
