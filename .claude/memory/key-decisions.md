---
name: key-decisions
description: 重要技术决策记录
metadata:
  type: project
---

# 关键决策

## 2026-06-06

1. **解析策略**：tree-sitter + ts-morph 分工协作
   - tree-sitter：快速文件扫描、JSX 语法提取、Express 路由匹配
   - ts-morph：类型信息提取、跨文件符号追踪、tRPC 深度分析

2. **Demo 策略**：自建 demo 先行 + cal.com 验证
   - 可控、无外部依赖、快速出效果
   - cal.com 作为兼容性验证，不作为主要 demo

3. **MVP 范围**：全部解析器（含 Express/TypeORM）
   - 用户选择保留，确保覆盖面

4. **存储**：better-sqlite3
   - 零配置、零依赖、支持增量更新

5. **可视化**：Cytoscape.js + dagre 布局
   - 专为大图设计，支持层次聚合、高性能渲染

6. **包管理**：pnpm monorepo + Turborepo
   - 与 cal.com 项目结构一致，便于测试

**Why:** 记录决策原因，避免后续反复讨论。

**How to apply:** 实现时如遇分歧，以此为准。
