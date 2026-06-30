# TASKS

## Stage A: feat/type-driven-design （照搬 plan 内 Task 0–9）
- [ ] A0 Bootstrap loop（建分支 + progress ledger）
- [ ] A1 修复 typecheck 门禁（composite tsconfig）
- [ ] A2 JSON 边界类型 (shared/types/json.ts)
- [ ] A3 封闭 Node metadata（discriminated union）
- [ ] A4 封闭 Edge metadata（含 imports/data_flows_to）
- [ ] A5 parser 改用 typed factory
- [ ] A6 storage 序列化/反序列化 typed
- [x] A7 MCP 去除 metadataValue
- [x] A8 UI API 边界 typed parse
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

## Stage HEALTH-FIX: fix/health-check （前置：master 基线，341 测试全过）
- [ ] H0  Bootstrap（建分支 + 基线快照）
- [ ] H1  RACE-01 分析结果共享 DB 句柄（server）
- [ ] H2  DUP-01 createDefaultParsers 工厂（analyzer/cli）
- [ ] H3  S-01 路径穿越守卫（server）
- [ ] H4  S-04 WebSocket Origin 校验（server）
- [ ] H5  BOUND-02 findLayoutFile 终止性（analyzer）
- [ ] H6  BOUND-03 箭头函数组件导出识别（analyzer）
- [ ] H7  TEST-BUG-01/02/03 伪测试重写
- [ ] H8  S-03 安全响应头（server）
- [ ] H9  LEAK-01 优雅关闭 wss（server）
- [ ] H10 MAGIC-02 readyState 用 WebSocket.OPEN（server）
- [ ] H11 DUP-03 AiConfigForm 公共组件（ui）
- [ ] H12 M2  TraceRunner 邻接索引（ui）
- [ ] H13 E-03 测试纳入 typecheck（全仓）
- [ ] H14 E-06 lint 警告清零
- [ ] H15 P-01 UI chunk 拆分
- [ ] H-MERGE 终态回归 + ff 合并 master + 收尾报告
