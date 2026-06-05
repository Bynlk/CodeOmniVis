---
name: known-issues
description: 已知问题和待解决项
metadata:
  type: project
---

# 已知问题

## 原始大纲中的 Bug

1. **项目大纲.md 第 447 行**：Prisma 解析器代码示例中 `edges` 变量未定义
   - 应在函数开头声明 `const edges: OmniEdge[] = []`
   - 返回值应为 `{ nodes, edges }` 而非 `nodes`
   - 已在设计文档中修正

## 技术风险

1. **tRPC 嵌套 router 解析**（概率：高）
   - cal.com 的 appRouter 包含多层嵌套
   - 缓解：降级为扁平 router 识别

2. **ts-morph monorepo 跨包追踪**（概率：中）
   - 需要正确配置 tsconfig.json 路径
   - 缓解：降级为同包追踪，跨包标记 inferred

3. **Cytoscape 大图性能**（概率：中）
   - 几百节点时布局可能超时
   - 缓解：Web Worker 布局，超时降级 grid

**Why:** 提前识别风险，避免开发时措手不及。

**How to apply:** 开发到相关模块时，参考此文件的缓解方案。
