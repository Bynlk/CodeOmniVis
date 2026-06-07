# Skill: Error Handling

> CodeOmniVis 错误处理模式。核心原则：降级而非崩溃。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 编写任何需要错误处理的代码
- 调试错误传播问题
- 设计错误报告格式

## 核心原则

**降级而非崩溃**：无法解析时返回空结果 + warning，不中断整个分析流程。

## 错误级别

| 级别 | 含义 | 处理方式 |
|------|------|---------|
| `error` | 致命错误，整个分析无法继续 | 终止当前文件分析，继续下一个 |
| `warning` | 可恢复错误，结果可能不完整 | 记录警告，返回部分结果 |
| `info` | 提示信息，不影响结果 | 记录日志 |

## 错误处理模式

### 解析器级别

```typescript
async function parse(filePath: string, context: ParseContext): Promise<ParseResult> {
  try {
    // 主逻辑
    return { nodes, edges, errors: [] }
  } catch (err) {
    // ✅ 正确：降级返回
    return {
      nodes: [],
      edges: [],
      errors: [{
        file: filePath,
        message: `Parser failed: ${(err as Error).message}`,
        severity: 'warning',
        originalError: err as Error,
      }],
    }
  }
}
```

### Pipeline 级别

```typescript
async function runPipeline(files: string[], context: ParseContext): Promise<ParseResult> {
  const allNodes: OmniNode[] = []
  const allEdges: OmniEdge[] = []
  const allErrors: ParseError[] = []

  for (const file of files) {
    // ✅ 单个文件失败不影响其他文件
    const parser = findParser(file, context.projectMeta)
    if (!parser) continue

    const result = await parser.parse(file, context)
    allNodes.push(...result.nodes)
    allEdges...result.edges)
    allErrors.push(...result.errors)
  }

  return { nodes: allNodes, edges: allEdges, errors: allErrors }
}
```

### Server 级别

```typescript
// Express 错误中间件
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  })
})
```

## 错误收集和报告

```typescript
// 收集所有错误，最后统一报告
const errors: ParseError[] = []

// 在分析过程中收集
errors.push({ file, message, severity: 'warning' })

// 最后报告
if (errors.length > 0) {
  console.log(`\n⚠️  ${errors.length} warnings:`)
  for (const err of errors) {
    console.log(`  - ${err.file}: ${err.message}`)
  }
}
```

## 禁止的模式

```typescript
// ❌ 错误：抛出异常中断整个分析
async function parse(file: string): Promise<OmniNode[]> {
  const result = await doParse(file)  // 可能抛异常
  return result
}

// ❌ 错误：吞掉错误不报告
async function parse(file: string): Promise<ParseResult> {
  try {
    return await doParse(file)
  } catch {
    return { nodes: [], edges: [], errors: [] }  // 错误被吞掉
  }
}

// ✅ 正确：捕获 + 报告 + 降级
async function parse(file: string): Promise<ParseResult> {
  try {
    return await doParse(file)
  } catch (err) {
    return {
      nodes: [],
      edges: [],
      errors: [{ file, message: (err as Error).message, severity: 'warning' }],
    }
  }
}
```
