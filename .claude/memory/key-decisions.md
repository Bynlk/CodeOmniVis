---
name: key-decisions
description: 重要技术决策记录
metadata:
  type: project
---

# 关键决策

## 2026-06-06

1. **解析策略**：ts-morph 统一解析
   - ts-morph：AST 解析、类型信息提取、跨文件符号追踪、JSX 提取
   - @prisma/internals：Prisma schema 解析

2. **Demo 策略**：自建 demo 先行 + cal.com 验证
   - 可控、无外部依赖、快速出效果
   - cal.com 作为兼容性验证，不作为主要 demo

3. **MVP 范围**：全部解析器（含 Express/TypeORM）
   - 用户选择保留，确保覆盖面

4. **存储**：sql.js（WASM）
   - 零配置、零原生依赖、浏览器兼容
   - 2026-06-30 从 better-sqlite3 迁移至 sql.js

5. **可视化**：Cytoscape.js + dagre 布局
   - 专为大图设计，支持层次聚合、高性能渲染

6. **包管理**：pnpm monorepo + Turborepo
   - 与 cal.com 项目结构一致，便于测试

**Why:** 记录决策原因，避免后续反复讨论。

**How to apply:** 实现时如遇分歧，以此为准。
