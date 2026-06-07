# 第二周 Claude Code Prompts

> 配置文件系统 + NestJS 解析器

---

## Prompt 2-A：配置文件系统

```
你是 CodeOmniVis 项目的开发者。

1. 读取 packages/shared/src/types/ 下的所有类型文件
2. 读取 packages/cli/src/utils/autoDetect.ts 完整内容
3. 读取 packages/cli/src/commands/serve.ts 完整内容

4. 创建 packages/shared/src/utils/configLoader.ts：

import * as fs from 'fs'
import * as path from 'path'
import type { CodeOmniVisConfig } from '../types/config'

const CONFIG_FILENAME = '.codeomnivis.json'

export function loadConfig(projectRoot: string): CodeOmniVisConfig {
  const configPath = path.join(projectRoot, CONFIG_FILENAME)

  if (!fs.existsSync(configPath)) {
    return getDefaultConfig(projectRoot)
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<CodeOmniVisConfig>
    return mergeWithDefaults(parsed, projectRoot)
  } catch (err) {
    console.warn(`[codeomnivis] Failed to parse ${CONFIG_FILENAME}: ${err}. Using defaults.`)
    return getDefaultConfig(projectRoot)
  }
}

function getDefaultConfig(projectRoot: string): CodeOmniVisConfig {
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
  partial: Partial<CodeOmniVisConfig>,
  projectRoot: string
): CodeOmniVisConfig {
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

5. 修改 packages/shared/src/index.ts，导出 configLoader

6. 修改 autoDetect.ts，接受可选 config 参数，配置值覆盖自动检测结果：

export async function autoDetect(
  root: string,
  config?: CodeOmniVisConfig
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

7. 修改 serve.ts、analyze.ts、check.ts：
   在 action 函数顶部加 const config = loadConfig(projectRoot)
   传入 autoDetect(projectRoot, config)

8. pnpm build 确认无错误
9. 在 demo/ 目录创建 .codeomnivis.json（只包含 { "port": 4322 }）
   运行 codeomnivis serve，确认服务在 4322 端口启动
```

---

## Prompt 2-B：NestJS 解析器

```
你是 CodeOmniVis 项目的开发者。

1. 读取 packages/analyzer/src/parsers/express.ts 完整内容（参考模式）
2. 读取 packages/analyzer/src/parsers/trpc.ts 完整内容（参考模式）
3. 读取 packages/analyzer/src/parsers/index.ts 完整内容

4. 创建以下文件：

─── packages/analyzer/src/parsers/nestjs/nestjsControllerParser.ts ───

import { Project, SyntaxKind, Decorator } from 'ts-morph'
import type { OmniNode, OmniEdge, NodeType } from '@codeomnivis/shared'

const HTTP_METHOD_DECORATORS = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options', 'All']

export const nestjsControllerParser = {
  name: 'nestjs-controller' as const,

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (!filePath.endsWith('.ts') || filePath.includes('node_modules')) return false
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.includes('@Controller') || content.includes('@RestController')
  },

  parse(filePath: string, context: ParseContext): ParseResult {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []

    const sourceFile = context.project.addSourceFileAtPath(filePath)

    for (const cls of sourceFile.getClasses()) {
      const controllerDecorator = cls.getDecorator('Controller')
      if (!controllerDecorator) continue

      const routePrefix = extractDecoratorStringArg(controllerDecorator) ?? ''

      for (const method of cls.getMethods()) {
        for (const httpMethod of HTTP_METHOD_DECORATORS) {
          const httpDecorator = method.getDecorator(httpMethod)
          if (!httpDecorator) continue

          const methodPath = extractDecoratorStringArg(httpDecorator) ?? ''
          const fullRoute = normalizePath(`${routePrefix}/${methodPath}`)

          const routeNodeId = `api_route:${filePath}:${httpMethod.toUpperCase()}:${fullRoute}`

          nodes.push({
            id: routeNodeId,
            type: 'api_route',
            name: `${httpMethod.toUpperCase()} ${fullRoute}`,
            filePath,
            line: method.getStartLineNumber(),
            column: method.getStart(),
            metadata: {
              method: httpMethod.toUpperCase(),
              route: fullRoute,
              controllerClass: cls.getName(),
              methodName: method.getName(),
              isNestJs: true,
              guards: extractGuards(method),
              interceptors: extractInterceptors(method),
            },
          })

          const handlerNodeId = `handler:${filePath}:${cls.getName()}:${method.getName()}`
          nodes.push({
            id: handlerNodeId,
            type: 'handler',
            name: `${cls.getName()}.${method.getName()}`,
            filePath,
            line: method.getStartLineNumber(),
            column: 0,
            metadata: { parentRouteId: routeNodeId, isNestJs: true },
          })

          edges.push(makeEdge(routeNodeId, handlerNodeId, 'handles', 'certain'))
        }
      }
    }

    return { nodes, edges }
  }
}

function extractDecoratorStringArg(decorator: Decorator): string | null {
  const args = decorator.getArguments()
  if (args.length === 0) return null
  const first = args[0]
  if (first.getKind() === SyntaxKind.StringLiteral) {
    return first.getText().replace(/['"]/g, '')
  }
  return null
}

function normalizePath(p: string): string {
  return '/' + p.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '')
}

function extractGuards(method: MethodDeclaration): string[] {
  return method.getDecorator('UseGuards')
    ?.getArguments()
    .map(a => a.getText()) ?? []
}

─── packages/analyzer/src/parsers/nestjs/nestjsModuleParser.ts ───

export const nestjsModuleParser = {
  name: 'nestjs-module' as const,

  canHandle(filePath: string): boolean {
    return filePath.endsWith('.module.ts') ||
           (filePath.endsWith('.ts') && fs.readFileSync(filePath,'utf-8').includes('@Module'))
  },

  parse(filePath: string, context: ParseContext): ParseResult {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const sourceFile = context.project.addSourceFileAtPath(filePath)

    for (const cls of sourceFile.getClasses()) {
      const moduleDecorator = cls.getDecorator('Module')
      if (!moduleDecorator) continue

      const moduleNodeId = `module:${filePath}:${cls.getName()}`
      const moduleArgs = moduleDecorator.getArguments()[0]
      if (!moduleArgs) continue

      const imports = extractArrayProperty(moduleArgs, 'imports')
      const providers = extractArrayProperty(moduleArgs, 'providers')
      const controllers = extractArrayProperty(moduleArgs, 'controllers')

      nodes.push({
        id: moduleNodeId,
        type: 'module',
        name: cls.getName() ?? 'Module',
        filePath,
        line: cls.getStartLineNumber(),
        column: 0,
        metadata: { imports, providers, controllers, isNestModule: true },
      })
    }

    return { nodes, edges }
  }
}

─── packages/analyzer/src/parsers/nestjs/nestjsServiceParser.ts ───

export const nestjsServiceParser = {
  name: 'nestjs-service' as const,

  canHandle(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf-8')
    return filePath.endsWith('.ts') &&
           (content.includes('@Injectable') || content.includes('@Service'))
  },

  parse(filePath: string, context: ParseContext): ParseResult {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const sourceFile = context.project.addSourceFileAtPath(filePath)

    for (const cls of sourceFile.getClasses()) {
      if (!cls.getDecorator('Injectable') && !cls.getDecorator('Service')) continue

      const serviceNodeId = `service:${filePath}:${cls.getName()}`

      const constructor = cls.getConstructors()[0]
      const injectedDeps: string[] = []

      if (constructor) {
        for (const param of constructor.getParameters()) {
          const paramType = param.getType().getText()
          injectedDeps.push(paramType)

          const injectRepoDecorator = param.getDecorator('InjectRepository')
          if (injectRepoDecorator) {
            const repoEntity = extractDecoratorStringArg(injectRepoDecorator)
              ?? injectRepoDecorator.getArguments()[0]?.getText()
            if (repoEntity) {
              const dbModelId = `db_model:${repoEntity}`
              edges.push(makeEdge(serviceNodeId, dbModelId, 'queries_db', 'inferred'))
            }
          }
        }
      }

      nodes.push({
        id: serviceNodeId,
        type: 'service',
        name: cls.getName() ?? 'Service',
        filePath,
        line: cls.getStartLineNumber(),
        column: 0,
        metadata: { injectedDependencies: injectedDeps, isNestService: true },
      })
    }

    return { nodes, edges }
  }
}

─── packages/analyzer/src/parsers/nestjs/index.ts ───

export { nestjsControllerParser } from './nestjsControllerParser'
export { nestjsModuleParser } from './nestjsModuleParser'
export { nestjsServiceParser } from './nestjsServiceParser'

5. 修改 packages/analyzer/src/parsers/index.ts，加入 export * from './nestjs'

6. 修改 packages/cli/src/utils/autoDetect.ts，在 detectBackendFramework 中
   添加 NestJS 检测：检查 @nestjs/core 或 @nestjs/common 依赖

7. 创建测试 fixture：
   packages/analyzer/__tests__/fixtures/nestjs/cats-controller.ts
   内容：一个简单的 @Controller('cats') 类，包含 @Get()/@Post()/@Get(':id')

8. 创建测试文件：
   packages/analyzer/__tests__/parsers/nestjsController.test.ts
   测试：解析 cats-controller.ts，验证生成了正确的 api_route 节点和 handles 边

9. pnpm test 确认测试通过
10. pnpm build 确认无 TypeScript 错误
```
