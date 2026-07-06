# Spec：feature-006-issue-badge（问题徽标 + WebSocket 状态可见）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（C2、C3、非协商项 5/6）
- **创建时间**：2026-07-07

## 一句话目标
让「问题」tab 的徽标数字来自真实 /api/graph/errors，并把 WebSocket 连接状态在 UI 上可见。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：App.tsx:124 处 issueBadgeCount 硬编码为 0
  - When：加载有错误的图数据
  - Then：问题 tab 徽标显示 /api/graph/errors 返回的真实问题数量，数量为 0 时不显示徽标或显示 0（design 固定）
- **AC2**
  - Given：useWebSocket 计算了 isConnected 但从未被消费
  - When：WebSocket 连接/断开
  - Then：UI（如顶栏）有明确的连接状态指示（已连接/断开中/重连），isConnected 被真实消费
- **AC3**
  - Given：徽标与状态接入
  - When：typecheck + test
  - Then：通过

## Non-Goals
- 本期不做：改动 /api/graph/errors 返回结构或服务器 WS 协议。

## 开发偏好
- 测试要求：badge 数量映射的单测。
- 交付节奏：依赖 feature-001（errors 走服务层）与 feature-006 自身 WS 消费。

## 遗留问题 / 待确认
- badge 为 0 时的呈现：design 固定为「隐藏徽标」。
