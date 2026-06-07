# Skill: Parser Development

> 编写 CodeOmniVis 解析器的专用指南。每个解析器遵循统一模式。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 实现新的框架解析器（parsers/*.ts）
- 修改现有解析器逻辑
- 调试解析器输出问题

## 解析器模板

所有解析器必须实现 `Parser` 接口：

```typescript
import type { Parser, ParseContext, ParseResult, ProjectMeta } from '@codeomnivis/shared'

export const xxxParser: Parser = {
  name: 'xxx',

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 1. 检查文件扩展名
    // 2. 检查文件路径模式
    // 3. 检查项目是否使用该框架
    return false
  },

  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    try {
      // 1. 读取文件
      // 2. 解析 AST / 提取信息
      // 3. 构建节点和边
      // 4. 返回结果
      return { nodes, edges, errors: [] }
    } catch (err) {
      // 降级：返回空结果 + warning
      return {
        nodes: [],
        edges: [],
        errors: [{
          file: filePath,
          message: `Parser [${this.name}] failed: ${(err as Error).message}`,
          severity: 'warning',
          originalError: err as Error,
        }],
      }
    }
  },
}
```

## 解析器分工

| 工具 | 负责 | 不负责 |
|------|------|--------|
| ts-morph | AST 解析、类型信息、跨文件 import、JSX 提取 | — |
| @prisma/internals | Prisma schema 解析 | 其他任何文件 |
| regex | 简单模式匹配（HTTP method、路由路径） | 复杂语法分析 |

## 节点 ID 生成

```typescript
import { createNodeId } from '@codeomnivis/shared'

// ✅ 正确
const id = createNodeId('db_model', schemaPath, model.name)
// → "db_model:prisma/schema.prisma:User"

// ❌ 错误：手动拼接（容易出错）
const id = `db_model:${schemaPath}:${model.name}`
```

## 边的生成规则

```typescript
import { createEdgeId } from '@codeomnivis/shared'

// 生成边时必须：
// 1. 验证 source 和 target 节点存在
// 2. 使用 createEdgeId 生成 ID
// 3. 标记 confidence

const edge: OmniEdge = {
  id: createEdgeId(sourceId, 'queries_db', targetId),
  source: sourceId,
  target: targetId,
  type: 'queries_db',
  confidence: 'certain', // 或 'inferred'
  metadata: { operation: 'findMany', callLine: 42 },
}
```

## ts-morph 使用模式

```typescript
import { Project, SyntaxKind } from 'ts-morph'

const project = new Project({
  tsConfigFilePath: context.tsConfigPath,
  skipAddingFilesFromTsConfig: true,
})

// 手动添加文件（更可控）
const sourceFile = project.addSourceFileAtPath(filePath)

// 查找特定节点
sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
  const expr = call.getExpression().getText()
  // 分析调用表达式
})
```

## 测试模式

```typescript
import { describe, it, expect } from 'vitest'
import { xxxParser } from '../../src/parsers/xxx'
import path from 'path'

const FIXTURES = path.resolve(__dirname, '../fixtures')

describe('xxxParser', () => {
  it('should parse normal input correctly', async () => {
    const result = await xxxParser.parse(
      path.join(FIXTURES, 'normal.xxx'),
      mockContext(),
    )
    expect(result.nodes).toHaveLength(expectedCount)
    expect(result.errors).toHaveLength(0)
  })

  it('should handle empty file gracefully', async () => {
    const result = await xxxParser.parse(
      path.join(FIXTURES, 'empty.xxx'),
      mockContext(),
    )
    expect(result.nodes).toHaveLength(0)
    expect(result.errors).toHaveLength(0) // 空文件不是错误
  })

  it('should return warning on parse failure', async () => {
    const result = await xxxParser.parse(
      path.join(FIXTURES, 'malformed.xxx'),
      mockContext(),
    )
    expect(result.nodes).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].severity).toBe('warning')
  })
})
```

## 注册解析器

在 `parsers/index.ts` 中注册：

```typescript
import { prismaParser } from './prisma'
import { trpcParser } from './trpc'
import type { Parser } from '@codeomnivis/shared'

export const parsers: Parser[] = [
  prismaParser,
  trpcParser,
  // ... 其他解析器
]
```
