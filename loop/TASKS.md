# TASKS

## Stage A: feat/type-driven-design （照搬 plan 内 Task 0–9）
- [ ] A0 Bootstrap loop（建分支 + progress ledger）
- [ ] A1 修复 typecheck 门禁（composite tsconfig）
- [ ] A2 JSON 边界类型 (shared/types/json.ts)
- [ ] A3 封闭 Node metadata（discriminated union）
- [ ] A4 封闭 Edge metadata（含 imports/data_flows_to）
- [ ] A5 parser 改用 typed factory
- [ ] A6 storage 序列化/反序列化 typed
- [ ] A7 MCP 去除 metadataValue
- [ ] A8 UI API 边界 typed parse
- [ ] A9 启用 type-aware ESLint
- [ ] A-MERGE 合并回 master，冻结类型基线

## Stage B: feat/ui-feature-suite （前置：A-MERGE 完成）
- [ ] B15 AI 请求契约修复 + localStorage 配置（落点 server/src/index.ts）
- [ ] B16 打包自包含 + 全局安装（tsup --noExternal + UI dist 内联 + sql.js wasm）
- [ ] B17 数据新鲜度方案一（状态可视化 + 智能监听 + 手动兜底；修 isAnalyzing 丢变更）
- [ ] B18 全链路追踪 tab（traceFromNode 双向 + /api/graph/trace + TracePanel/TraceRunner/TraceStepCard + 分层泳道 + 循迹光点 + 节点自动说明）
- [ ] B19 图谱噪声治理 + POST /api/project 运行时选目录
- [ ] B20 设置抽屉(AI/项目/显示/关于) + 三层推广位 + 非商业 License 措辞
- [ ] B-MERGE 全量回归 + 合并回 master + 收尾报告
