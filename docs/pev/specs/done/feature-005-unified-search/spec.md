# Spec：feature-005-unified-search（统一搜索）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（C5、G3、非协商项 4）
- **创建时间**：2026-07-07

## 一句话目标
消除「Header 搜索框」与「CommandPalette」两条并行搜索轨道，统一为单一搜索状态与单一索引来源。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：当前存在 Header query 与 CommandPalette 两套搜索
  - When：审阅搜索相关代码
  - Then：搜索词只有**单一真源**（uiStore.searchQuery），Header 与 CommandPalette 共用同一状态与同一 searchNodes 索引，无重复实现
- **AC2**
  - Given：统一后
  - When：在 Header 输入 或 Cmd+K 面板输入
  - Then：两处结果一致；Header 输入即时过滤侧栏/画布可见节点，Cmd+K 用于快速跳转，二者互不冲突
- **AC3**
  - Given：统一搜索
  - When：typecheck + test
  - Then：通过，既有 useSearch 测试不回归

## Non-Goals
- 本期不做：加入模糊搜索/正则等新搜索算法（保持既有 searchNodes 语义）。

## 开发偏好
- 测试要求：搜索状态同步的最小单测。
- 交付节奏：依赖 feature-002。

## 遗留问题 / 待确认
- 无。
