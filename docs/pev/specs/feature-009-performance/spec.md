# Spec：feature-009-performance（性能预算）

- **版本**：v1
- **状态**：todo
- **对应纳管需求**：frontend-redesign-brief_v1.md（G9、C1）
- **创建时间**：2026-07-07

## 一句话目标
达成性能预算：FCP ≤ 2s，主 chunk（gzip 后）≤ 80KB，无 vendor-react 循环依赖问题。

## 验收标准（Acceptance Criteria）
- **AC1**
  - Given：构建产物
  - When：运行 `pnpm --filter @codeomnivis/ui build` 并检查产物体积
  - Then：入口主 chunk gzip ≤ 80KB（Cytoscape 等大依赖按需/分包，不计入主 chunk 或经手动 chunk 拆分），构建无 vendor-react 循环警告
- **AC2**
  - Given：分包策略
  - When：审阅 vite.config.ts 的 manualChunks
  - Then：react/react-dom、cytoscape、i18next 等按合理分包；首屏不加载非必要面板代码（懒加载分析/AI 面板）
- **AC3**
  - Given：性能改造
  - When：本地 preview 度量 FCP（Lighthouse 或 performance API）
  - Then：FCP ≤ 2s（本地基准环境）；typecheck + test 通过

## Non-Goals
- 本期不做：SSR/预渲染；不做 CDN 托管（禁止外部 CDN）。

## 开发偏好
- 测试要求：以构建体积报告与 Lighthouse 数值为准，结论记入 progress-log。
- 交付节奏：最后收口，因依赖前面所有代码定型。

## 遗留问题 / 待确认
- FCP 度量环境以本地 preview 为基准，若受机器影响波动，记录实测值与说明。
