# 技术方案设计：feature-009-performance
- **对应 spec**：./spec.md
- **版本**：v1
## 方案概述
用 vite manualChunks 拆分大依赖，React.lazy 懒加载非首屏面板（AI/Stats/DataFlow/Trace），确保主 chunk 精简；核查 C1 vendor-react 循环已消除。
## 关键设计
- manualChunks：react-vendor（react/react-dom）、cytoscape-vendor、i18n-vendor。
- 懒加载：分析/智能类面板用 React.lazy + Suspense。
- 消除 barrel 文件导致的循环导入。
## 遵守的技术铁律
- 禁止外部 CDN；Cytoscape 不可替换（但可分包/延迟初始化）。
## 风险与边界
- 懒加载边界需保留骨架/占位，避免切 tab 白屏。
## 任务拆解
- [ ] manualChunks 配置
- [ ] 面板懒加载 + Suspense
- [ ] 构建体积核验
- [ ] FCP 度量并记录
