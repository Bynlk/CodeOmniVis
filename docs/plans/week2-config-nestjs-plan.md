# 第二周计划书：配置文件系统 + NestJS 解析器

> 目标：配置文件生效、覆盖最大 TS 后端生态
> 完成后可以说：支持 Next.js / NestJS / Express / tRPC

---

## Task 2.1：实现 .omnivis.json 加载

**根因**：`init` 命令生成配置文件，但全项目没有任何代码读取它。

### 2.1.1 配置加载器

新建 `packages/shared/src/utils/configLoader.ts`：

```typescript
import * as fs from 'fs'
import * as path from 'path'
import type { OmniVisConfig } from '../types/config'

const CONFIG_FILENAME = '.omnivis.json'

export function loadConfig(projectRoot: string): OmniVisConfig {
  const configPath = path.join(projectRoot, CONFIG_FILENAME)

  if (!fs.existsSync(configPath)) {
    return getDefaultConfig(projectRoot)
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<OmniVisConfig>
    return mergeWithDefaults(parsed, projectRoot)
  } catch (err) {
    console.warn(`[omnivis] Failed to parse ${CONFIG_FILENAME}: ${err}. Using defaults.`)
    return getDefaultConfig(projectRoot)
  }
}

function getDefaultConfig(projectRoot: string): OmniVisConfig {
  return {
    root: projectRoot,
    frontend: { dirs: [], framework: 'auto' },
    backend: { dirs: [], framework: 'auto' },
    database: {},
    exclude: ['node_modules', 'dist', '.next', 'coverage', '.git'],
    port: 4321,
  }
}

function mergeWithDefaults(
  partial: Partial<OmniVisConfig>,
  projectRoot: string
): OmniVisConfig {
  const defaults = getDefaultConfig(projectRoot)
  return {
    ...defaults,
    ...partial,
    frontend: { ...defaults.frontend, ...partial.frontend },
    backend: { ...defaults.backend, ...partial.backend },
    database: { ...defaults.database, ...partial.database },
    exclude: partial.exclude ?? defaults.exclude,
  }
}
```

### 2.1.2 CLI 命令集成配置

在 `serve.ts` / `analyze.ts` / `check.ts` 的 action 函数顶部添加：

```typescript
import { loadConfig } from '@omnivis/shared'

const projectRoot = path.resolve(options.project ?? '.')
const config = loadConfig(projectRoot)
const projectMeta = await autoDetect(projectRoot, config)
```

### 2.1.3 autoDetect 接受配置覆盖

修改 `packages/cli/src/utils/autoDetect.ts`：

```typescript
export async function autoDetect(
  root: string,
  config?: OmniVisConfig
): Promise<ProjectMeta> {
  const detected = await doAutoDetect(root)

  if (config) {
    if (config.frontend.framework !== 'auto') {
      detected.frontendFramework = config.frontend.framework
    }
    if (config.frontend.dirs.length > 0) {
      detected.frontendDirs = config.frontend.dirs.map(d => path.resolve(root, d))
    }
    if (config.backend.dirs.length > 0) {
      detected.backendDirs = config.backend.dirs.map(d => path.resolve(root, d))
    }
    if (config.database.prismaSchema) {
      detected.prismaSchemaPath = path.resolve(root, config.database.prismaSchema)
    }
    detected.excludePatterns = config.exclude
    detected.port = config.port
  }

  return detected
}
```

---

## Task 2.2：NestJS 解析器

NestJS 是 TypeScript 后端最大的生态（65k stars），装饰器模式与 Spring Boot 高度相似。

### 2.2.1 NestJS Controller 解析器

新建 `packages/analyzer/src/parsers/nestjs/nestjsControllerParser.ts`：

- 解析 `@Controller('/prefix')` 装饰器提取路由前缀
- 遍历方法的 HTTP 装饰器（`@Get`/`@Post`/`@Put`/`@Delete`/`@Patch`）
- 生成 `api_route` 节点，metadata 含 `method`/`route`/`controllerClass`/`guards`/`interceptors`
- 生成 `handler` 节点
- 生成 `route → handler` 的 `handles` 边（confidence: certain）

### 2.2.2 NestJS Module 解析器

新建 `packages/analyzer/src/parsers/nestjs/nestjsModuleParser.ts`：

- 解析 `@Module({})` 装饰器
- 提取 `imports`/`providers`/`controllers` 数组
- 生成 `module` 节点

### 2.2.3 NestJS Service/Provider 解析器

新建 `packages/analyzer/src/parsers/nestjs/nestjsServiceParser.ts`：

- 解析 `@Injectable()` 装饰器
- 检测 constructor 注入的依赖
- 特殊处理 `@InjectRepository` → 生成 `queries_db` 边（inferred）
- 生成 `service` 节点

### 2.2.4 框架检测

修改 `autoDetect.ts` 中的 `detectBackendFramework`：

```typescript
function detectBackendFramework(root: string, pkgJson: any): BackendFramework {
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
  if (deps['@nestjs/core'] || deps['@nestjs/common']) return 'nestjs'
  if (deps['express']) return 'express'
  if (deps['fastify']) return 'fastify'
  if (deps['hono']) return 'hono'
  return 'unknown'
}
```

### 2.2.5 注册解析器

- 新建 `packages/analyzer/src/parsers/nestjs/index.ts` 导出三个解析器
- 修改 `packages/analyzer/src/parsers/index.ts`，加入 `export * from './nestjs'`

---

## 验收标准

```bash
# 配置文件验证
cd demo/
cat .omnivis.json
npx omnivis serve   # 观察 CLI 输出中是否提示"配置文件已加载"

# NestJS 验证
git clone https://github.com/nestjs/nest samples/nestjs-demo
npx omnivis serve --project samples/nestjs-demo/sample01-cats-app
# 期望：
# - 检测到 NestJS 框架
# - UI 中出现 api_route 节点（如 GET /cats, POST /cats）
# - api_route → handler 的 handles 边存在
```

---

## 执行时间线

| 天 | 任务 |
|----|------|
| Day 1 | Task 2.1：配置文件系统 |
| Day 2-3 | Task 2.2：NestJS 解析器（Controller + Module + Service） |
| Day 4 | 验收测试，NestJS 官方 sample 跑通 |
