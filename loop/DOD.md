# 全局完成定义 (DOD)

## Stage A — 类型安全
- [ ] AST: any=0, assertions=0, doubleCasts=0；unknown 仅在运行时边界
- [ ] NodeMetadata / EdgeMetadata 无 Record<string,unknown> fallback
- [ ] OmniNode / OmniEdge 为 discriminated union
- [ ] metadataValue() 已删除
- [ ] 六包 typecheck 全过；相关 vitest 套件全过
- [ ] strict ESLint (no-unsafe-*) 落地
- [ ] 分支 feat/type-driven-design 已 push，合并回 master

## Stage B — 前端能力 (#15–#20)
- [ ] #15 AI 契约修复 + localStorage 配置可用（落点 server/src/index.ts）
- [ ] #16 自包含打包 + 全局安装可跑（UI dist 内联 + sql.js wasm 随包）
- [ ] #17 数据新鲜度方案一（状态可视化+智能监听+手动兜底）
- [ ] #18 全链路追踪 tab（双向 traceFromNode + 分层泳道 + 循迹光点）
- [ ] #19 图谱噪声治理 + POST /api/project 选目录
- [ ] #20 设置抽屉(四组) + 三层推广位 + 非商业 License 措辞
- [ ] 全量回归：typecheck && lint && test && build 全绿
- [ ] 分支 feat/ui-feature-suite 已 push，合并回 master

## 通用
- [ ] 每任务一个绿色 commit；git diff --check 干净
- [ ] PROGRESS.json 每任务一条；DELIVERY_REPORT/CHANGELOG/TECHNICAL_DEBT 收尾产出
