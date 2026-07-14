# CodeOmniVis 文档导航

这份目录把当前仓库里仍然有参考价值的文档按用途重新整理了一遍。部分文件是历史计划或阶段性快照，阅读时请优先以源码和根目录 `README.md` 为准。

## 快速入口

- [项目首页 README](../README.md) — 产品定位、快速开始、命令行、MCP 集成
- [Demo 指南](../demo/README.md) — 如何用仓库内样例项目体验图谱
- [REST API](api/rest-api.md) — `serve` 启动后暴露的 HTTP / WebSocket 接口
- [MCP 工具说明](api/mcp-tools.md) — MCP tool 的输入、输出和典型问题
- [测试智能指南](guides/test-intelligence.md) — 支持框架、静态覆盖语义、执行与 XML 导入边界

## 架构与实现

- [项目目录结构](project-directory.md) — 仓库目录和主要职责
- [解析流水线](architecture/parser-pipeline.md) — 解析器、构图与连线设计
- [数据模型](architecture/data-model.md) — 节点、边与存储结构
- [可视化设计](architecture/visualization.md) — UI 层与图谱展示思路

## 状态与报告

- [质量 90 复评报告](reports/2026-07-14-quality-90-reassessment.md) — 0.1.0 发布后的七维评分、证据、扣分项与改进建议
- [质量工程基线](reports/2026-07-14-quality-baseline.md) — 90 分工程启动前的冻结事实与缺口
- [项目状态报告](PROJECT_STATUS_REPORT.md) — 当前代码基线与阶段性评估
- [补充状态报告](reports/codeomnivis-status-report.md) — 另一份阶段报告快照
- [已验证计划](VERIFIED_PLAN.md) — 计划校验记录

## 计划与演进记录

- [开发计划书](plans/development-plan.md)
- [框架扩展设计](plans/framework-expansion-design.md)
- [Kotlin 支持计划](plans/kotlin-support-plan.md)
- [Phase 1 + 2 实施计划](plans/codeomnivis-phase1-phase2-plan.md)
- [计划变更记录](plans/changelog.md)
- [计划状态快照](plans/PROJECT_STATUS.md)

## 历史 / 归档

- [工程计划 V2](DEVELOPMENT_PLAN_V2.md)
- [工程总计划](ENGINEERING_PLAN.md)
- [旧版计划草稿](codeomnivis-plan-3.md)
- [项目大纲归档](archive/项目大纲.md)
- [Superpowers 设计稿](superpowers/specs/2026-06-06-codeomnivis-design.md)

## Demo 与验证资料

- [Demo 项目说明](demo/demo-project.md)
- [cal.com 验证记录](demo/cal-com-validation.md)
