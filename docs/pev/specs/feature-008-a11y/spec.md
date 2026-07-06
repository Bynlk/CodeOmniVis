# Spec：feature-008-a11y（可访问性 ≥90）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G6）
- **创建时间**：2026-07-07

## 一句话目标
补齐语义化标签、键盘可达、焦点管理、对比度与 aria 属性，使可访问性审计分数 ≥90。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：交互控件缺少 aria/键盘支持
  - When：仅用键盘操作（Tab/Enter/Esc/方向键）
  - Then：搜索、tab 切换、命令面板、抽屉开合、节点列表选择均可用，焦点可见且不丢失
- **AC2**
  - Given：色彩对比与语义
  - When：对主要文本/按钮做对比度检查
  - Then：正文对比度达 WCAG AA；交互元素有可辨识 focus ring；图标按钮有 aria-label
- **AC3**
  - Given：a11y 改造
  - When：运行可访问性审计（Lighthouse a11y 或等价）
  - Then：分数 ≥90；typecheck + test 通过

## Non-Goals
- 本期不做：完整 WCAG AAA；不做屏幕阅读器逐场景脚本录制。

## 开发偏好
- 测试要求：关键控件的 aria/role 存在性测试。
- 交付节奏：贯穿各 feature，末尾集中收口审计。

## 遗留问题 / 待确认
- 审计工具：优先 Lighthouse a11y，环境不便则用 axe 规则清单人工核对，结论记入 progress-log。
