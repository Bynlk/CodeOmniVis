# Spec：feature-007-responsive（响应式布局）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G5、非协商项 8）
- **创建时间**：2026-07-07

## 一句话目标
在 sm/md/lg 三个断点下界面均可用；≤768px 时侧栏与面板改为抽屉式，不挤爆画布。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：窄屏（≤768px）
  - When：打开页面
  - Then：Sidebar 与分析面板收起为可唤出的抽屉，画布占主视口，无横向溢出/内容被裁
- **AC2**
  - Given：sm/md/lg 三档
  - When：分别在三档下浏览
  - Then：布局自适应重排，关键操作（搜索、tab、图例、节点选择）在每档都可达
- **AC3**
  - Given：响应式落地
  - When：typecheck + test + 目测三档
  - Then：通过

## Non-Goals
- 本期不做：为移动端做触控手势专项优化（保证可用即可）。

## 开发偏好
- 测试要求：断点相关的关键渲染测试。
- 交付节奏：依赖 feature-004。

## 遗留问题 / 待确认
- 断点值采用 Tailwind 默认（sm=640/md=768/lg=1024），抽屉阈值 768px。
