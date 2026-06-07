# Skill: Testing Patterns

> CodeOmniVis 测试开发指南。基于 Vitest。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 编写单元测试
- 编写集成测试
- 调试测试失败
- 添加测试 fixture

## 技术栈

- **Vitest 1.x** — 测试框架（与 Vite 共享配置）
- **fixtures/** — 测试数据文件

## 测试文件位置

```
源文件：packages/analyzer/src/parsers/prisma.ts
测试文件：packages/analyzer/__tests__/parsers/prisma.test.ts

源文件：packages/analyzer/src/graph/builder.ts
测试文件：packages/analyzer/__tests__/graph/builder.test.ts
```

## 测试模板

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { xxxParser } from '../../src/parsers/xxx'
import path from 'path'
import type { ParseContext, ProjectMeta } from '@codeomnivis/shared'

const FIXTURES = path.resolve(__dirname, '../fixtures')

// Mock 上下文
function mockContext(overrides?: Partial<ParseContext>): ParseContext {
  return {
    projectRoot: FIXTURES,
    projectMeta: mockProjectMeta(),
    tsConfig: null,
    pathAliases: { '@/': 'src/' },
    ...overrides,
  }
}

function mockProjectMeta(overrides?: Partial<ProjectMeta>): ProjectMeta {
  return {
    root: FIXTURES,
    frontendFramework: 'next',
    backendFramework: 'trpc',
    databaseType: 'prisma',
    monorepoType: 'none',
    frontendDirs: ['app/'],
    backendDirs: ['server/'],
    trpcRouterPaths: ['server/routers/'],
    prismaSchemaPath: path.join(FIXTURES, 'schema.prisma'),
    typeormEntityDirs: [],
    tsConfigPath: null,
    packages: [],
    ...overrides,
  }
}

describe('xxxParser', () => {
  describe('canHandle', () => {
    it('should handle matching files', () => {
      expect(xxxParser.canHandle('app/page.tsx', mockProjectMeta())).toBe(true)
    })

    it('should not handle non-matching files', () => {
      expect(xxxParser.canHandle('style.css', mockProjectMeta())).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse normal input correctly', async () => {
      const result = await xxxParser.parse(
        path.join(FIXTURES, 'schema.prisma'),
        mockContext(),
      )

      expect(result.nodes.length).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)

      // 验证第一个节点
      const firstNode = result.nodes[0]
      expect(firstNode.type).toBe('db_model')
      expect(firstNode.id).toMatch(/^db_model:/)
    })

    it('should handle empty input gracefully', async () => {
      const result = await xxxParser.parse(
        path.join(FIXTURES, 'schema-empty.prisma'),
        mockContext(),
      )

      expect(result.nodes).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should return warning on failure', async () => {
      const result = await xxxParser.parse(
        '/nonexistent/file.prisma',
        mockContext(),
      )

      expect(result.nodes).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].severity).toBe('warning')
    })

    it('should produce correct edge structure', async () => {
      const result = await xxxParser.parse(
        path.join(FIXTURES, 'schema.prisma'),
        mockContext(),
      )

      // 验证边的 source 和 target 都存在于节点中
      const nodeIds = new Set(result.nodes.map(n => n.id))
      for (const edge of result.edges) {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
      }
    })
  })
})
```

## 测试运行命令

```bash
# 运行所有测试
pnpm test

# 运行指定包的测试
pnpm --filter @codeomnivis/analyzer test

# 运行指定测试文件
pnpm --filter @codeomnivis/analyzer test -- prisma.test.ts

# 监听模式
pnpm --filter @codeomnivis/analyzer test:watch

# 带覆盖率
pnpm --filter @codeomnivis/analyzer test --coverage
```

## Fixture 管理

```
packages/analyzer/__tests__/
├── fixtures/
│   ├── schema.prisma          # 完整测试数据
│   ├── schema-empty.prisma    # 边界：空文件
│   ├── schema-minimal.prisma  # 边界：最少数据
│   └── trpc-router.ts         # tRPC 测试数据
├── parsers/
│   ├── prisma.test.ts
│   └── trpc.test.ts
└── graph/
    └── builder.test.ts
```

**规则**：
- fixture 文件尽量小（< 50 行）
- 每个测试用例独立，不依赖执行顺序
- 不依赖外部项目作为 fixture
- fixture 文件名清晰表达测试场景

## Mock 策略

```typescript
// Mock 文件系统（如果需要）
vi.mock('fs', async () => ({
  ...await vi.importActual('fs'),
  readFileSync: vi.fn().mockReturnValue('mock content'),
}))

// Mock ts-morph Project
vi.mock('ts-morph', () => ({
  Project: vi.fn().mockImplementation(() => ({
    addSourceFileAtPath: vi.fn().mockReturnValue(mockSourceFile),
  })),
}))
```
