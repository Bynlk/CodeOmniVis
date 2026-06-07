# Skill: Monorepo Patterns

> pnpm workspace + Turborepo monorepo 开发模式。

## 适用场景

当任务涉及以下内容时使用本 skill：
- 新建包或修改包配置
- 跨包依赖管理
- 构建和测试命令
- 调试包引用问题

## 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包（按依赖顺序）
pnpm build

# 构建单个包
pnpm --filter @codeomnivis/analyzer build

# 运行单个包的测试
pnpm --filter @codeomnivis/analyzer test

# 运行所有测试
pnpm test

# 添加依赖到指定包
pnpm --filter @codeomnivis/analyzer add ts-morph

# 添加开发依赖
pnpm --filter @codeomnivis/analyzer add -D vitest

# 添加 workspace 内部依赖
pnpm --filter @codeomnivis/server add @codeomnivis/shared@workspace:*
```

## 包间依赖规则

```
shared        ← 无依赖（纯类型）
analyzer      ← shared
server        ← shared, analyzer
ui            ← 无代码依赖（通过 REST API 访问 server）
mcp           ← shared, analyzer
cli           ← shared, analyzer, server
```

**规则**：
- 下游包不能被上游包依赖（禁止循环）
- ui 包不直接 import 其他包（通过 HTTP 访问）
- 所有包通过 `@codeomnivis/shared` 共享类型

## 新建包的步骤

1. 创建 `packages/xxx/package.json`
2. 创建 `packages/xxx/tsconfig.json`（extends `../../tsconfig.base.json`）
3. 创建 `packages/xxx/src/index.ts`
4. 在 `tsconfig.json` 的 `references` 中添加依赖包
5. 运行 `pnpm install`

## tsconfig references

每个包的 `tsconfig.json` 需要声明对其他包的引用：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

## Turborepo 任务依赖

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // 先构建依赖包
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]  // 测试前先构建
    }
  }
}
```

## 调试技巧

```bash
# 查看包依赖图
pnpm why @codeomnivis/shared

# 清除构建缓存
pnpm clean

# 重新安装
pnpm install --force

# 查看 turbo 构建计划
pnpm build --dry-run
```
