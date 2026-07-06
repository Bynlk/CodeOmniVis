# 技术方案设计：feature-006-issue-badge

- **对应 spec**：./spec.md
- **版本**：v1

## 方案概述
新增 useGraphErrors（React Query，走 services.getGraphErrors）供 issues badge 与 IssuesPanel 共用；WS 的 isConnected 通过 uiStore 或 context 暴露给 Header 的状态指示灯。

## 关键设计
- badge 数量 = useGraphErrors().data?.length ?? 0；App 传入真实值替换硬编码 0；为 0 隐藏。
- WS：useWebSocket 把 isConnected 写入一个可订阅处（context 或 store），Header 渲染状态点（绿/黄/红 + i18n 文案）。
- errors 由 WS 事件 invalidate（现有 queryClient.invalidateQueries(['graph-errors']) 已具备）。

## 遵守的技术铁律
- 数据契约不变。

## 风险与边界
- 重连抖动：状态指示需防抖，避免闪烁。

## 任务拆解
- [ ] useGraphErrors hook
- [ ] TabBar badge 接真实值
- [ ] WS isConnected 暴露 + Header 状态指示灯
- [ ] 测试
