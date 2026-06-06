# OmniVis 全框架扩展设计文档

> **文档版本**：v1.0
> **创建日期**：2026-06-06
> **状态**：设计完成，待开发

---

## 目录

1. [背景与动机](#1-背景与动机)
2. [竞品分析](#2-竞品分析)
3. [扩展范围](#3-扩展范围)
4. [现有架构分析](#4-现有架构分析)
5. [类型系统扩展](#5-类型系统扩展)
6. [框架检测扩展](#6-框架检测扩展)
7. [文件扫描扩展](#7-文件扫描扩展)
8. [解析器设计](#8-解析器设计)
9. [跨层连线扩展](#9-跨层连线扩展)
10. [解析器注册集中化](#10-解析器注册集中化)
11. [测试策略](#11-测试策略)
12. [实施计划](#12-实施计划)
13. [关键文件清单](#13-关键文件清单)
14. [验证方式](#14-验证方式)

---

## 1. 背景与动机

### 1.1 当前状态

OmniVis 目前支持以下框架组合：

| 层 | 支持的框架 |
|----|----------|
| 前端 | Next.js (App Router + Pages Router), React |
| 后端 | tRPC, Express |
| 数据库 | Prisma, TypeORM |

### 1.2 市场机会

竞品分析显示，**市场上没有一个工具同时做到以下三点**：

1. 从代码自动提取架构（不需要手写 DSL）
2. 理解框架特定模式（Next.js 路由、tRPC 路由器、Prisma schema）
3. 三层打通可视化（前端组件 → 后端 API → 数据库）

现有工具各自只覆盖一个切片：

| 工具 | Stars | 做什么 | 缺什么 |
|------|-------|--------|--------|
| Madge | ~13.6k | JS/TS 模块依赖图 | 不理解框架，不看 DB |
| LikeC4 | ~8k | C4 架构图 | 需手写 DSL，不自动提取 |
| prisma-erd-generator | ~1.8k | Prisma ER 图 | 只有 DB 层 |
| CodeSee | SaaS | 代码架构地图 | 闭源付费，不专精 TS 全栈 |
| Nx Graph | ~23k | Monorepo 依赖图 | 只看包级别，不看应用架构 |

### 1.3 扩展目标

将 OmniVis 从"Next.js 专属工具"扩展为"全栈 TypeScript 架构洞察引擎"，覆盖主流前端框架、后端框架和数据库 ORM。

---

## 2. 竞品分析

### 2.1 详细对比

| 维度 | OmniVis (扩展后) | LikeC4 | CodeSee | Madge |
|------|-----------------|--------|---------|-------|
| 自动提取 | ✅ 从代码自动提取 | ❌ 需手写 DSL | ✅ 自动 | ✅ 自动 |
| 框架感知 | ✅ 识别框架特定模式 | ❌ 通用 | ❌ 通用 | ❌ 通用 |
| 三层打通 | ✅ 前端+后端+DB | ❌ 只有架构层 | ⚠️ 无 DB | ❌ 只有模块依赖 |
| 交互式 | ✅ Cytoscape.js | ✅ React | ✅ Web | ❌ 静态 SVG |
| 本地运行 | ✅ SQLite | ✅ 本地 | ❌ SaaS | ✅ 本地 |
| AI 接口 | ✅ MCP | ❌ | ❌ | ❌ |
| 开源 | ✅ MIT | ✅ MIT | ❌ 闭源 | ✅ MIT |

### 2.2 差异化优势

**一句话**：唯一一个 `npx omnivis serve` 就能跑的全栈 TS 架构图工具。

具体优势：

1. **零配置** — 自动检测框架，无需手写配置
2. **三层打通** — 组件→API→DB 一条线可视化
3. **框架感知** — 区分 App Router vs Pages Router，识别 tRPC procedure
4. **本地运行** — SQLite 存储，不上传代码
5. **AI 接口** — MCP 包，可被 Claude Code/Cursor 直接调用

---

## 3. 扩展范围

### 3.1 框架清单（按 npm 周下载量排序）

#### 前端框架

| 框架 | npm 包 | 周下载量 | GitHub Stars | 优先级 |
|------|--------|---------|-------------|--------|
| Vue.js | `vue` | 12,478,656 | 53,777 | Phase 1 |
| Angular | `@angular/core` | 5,513,617 | 100,308 | Phase 2 |
| Svelte | `svelte` | 4,469,521 | 86,861 | Phase 2 |
| Astro | `astro` | 3,100,154 | 59,880 | Phase 3 |
| SvelteKit | `@sveltejs/kit` | 1,889,956 | 20,553 | Phase 2 |
| Nuxt | `nuxt` | 1,537,750 | 60,358 | Phase 1 |
| Remix | `@remix-run/react` | 980,270 | 33,018 | 待定 |

#### 后端框架

| 框架 | npm 包 | 周下载量 | GitHub Stars | 优先级 |
|------|--------|---------|-------------|--------|
| NestJS | `@nestjs/core` | 10,772,173 | 75,693 | Phase 1 |
| Fastify | `fastify` | 7,868,564 | 36,402 | Phase 2 |
| Koa | `koa` | 7,843,311 | 35,712 | Phase 2 |
| Hono | `hono` | 40,105,063* | 30,839 | Phase 3 |

*Hono 下载量被 Cloudflare Workers 工具链膨胀，GitHub Stars 更能反映真实用户量。

#### 数据库 ORM

| ORM | npm 包 | 周下载量 | GitHub Stars | 优先级 |
|-----|--------|---------|-------------|--------|
| Drizzle ORM | `drizzle-orm` | 10,483,141 | 34,692 | Phase 1 |
| Knex | `knex` | 4,210,226 | 20,286 | Phase 3 |
| Sequelize | `sequelize` | 2,931,451 | 30,354 | Phase 3 |
| MikroORM | `@mikro-orm/core` | 714,690 | 9,072 | Phase 3 |

### 3.2 阶段划分

```
Phase 1: Vue/Nuxt + NestJS + Drizzle    → 覆盖 ~35M 周下载量用户
Phase 2: Angular + Svelte/SvelteKit + Fastify/Koa → 覆盖 ~25M 周下载量用户
Phase 3: Astro + Sequelize/MikroORM/Knex + Hono  → 覆盖 ~11M 周下载量用户
```

---

## 4. 现有架构分析

### 4.1 Parser 接口

定义于 `packages/shared/src/types/graph.ts`：

```typescript
export interface Parser {
  name: string
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean
  parse(filePath: string, context: ParseContext): Promise<ParseResult>
}
```

- `canHandle()` — 门控函数，根据文件路径和项目元数据决定是否处理
- `parse()` — 实际解析，返回 `ParseResult { nodes, edges, errors }`

### 4.2 当前解析器

| 文件 | 类名 | name | 功能 |
|------|------|------|------|
| `prisma.ts` | PrismaParser | `'prisma'` | Prisma schema → db_model + db_relation |
| `nextjsApp.ts` | NextjsAppParser | `'nextjs-app'` | App Router → page + api_route |
| `nextjsPages.ts` | NextjsPagesParser | `'nextjs-pages'` | Pages Router → page + api_route |
| `trpc.ts` | TrpcParser | `'trpc'` | tRPC 路由器 → trpc_procedure |
| `express.ts` | ExpressParser | `'express'` | Express 路由 → api_route |
| `typeorm.ts` | TypeormParser | `'typeorm'` | TypeORM 实体 → db_model + db_relation |
| `apiCalls.ts` | ApiCallsParser | `'api-calls'` | fetch/axios/trpc 调用 → calls_api 边 |
| `reactComponent.ts` | ReactComponentParser | `'react-component'` | React 组件 → component + renders |

### 4.3 分析流水线

```
CLI (analyze.ts)
  │
  ├─→ autoDetectProject(root)  →  ProjectMeta
  │     (package.json + 文件系统扫描)
  │
  ├─→ scanDirectory()  →  file list (string[])
  │
  ├─→ GraphBuilder.registerParsers([全部 8 个解析器])
  │
  ├─→ GraphBuilder.parseFiles(files, context)
  │     │
  │     ├─→ 遍历每个文件:
  │     │     遍历每个解析器:
  │     │       if parser.canHandle(file, projectMeta):
  │     │         result = parser.parse(file, context)
  │     │         累积 nodes, edges, errors
  │     │
  │     ├─→ 节点去重 (by id, 后者覆盖)
  │     ├─→ 边验证 + 去重
  │     └─→ 写入 OmniDatabase (SQLite)
  │
  ├─→ CrossLayerLinker.link(graph)  →  跨层边
  │     (calls_api, handles, calls_service, queries_db)
  │
  └─→ 合并跨层边 → 写入 JSON 输出
```

### 4.4 关键设计决策（现有）

1. **无条件注册** — 所有解析器始终注册，`canHandle()` 是唯一的分派机制
2. **多解析器处理同一文件** — 一个 `.tsx` 文件可同时被 NextjsAppParser、ReactComponentParser、ApiCallsParser 处理
3. **降级不崩溃** — 解析错误收集到 `ParseError[]`，不抛异常
4. **calls_api 边特殊处理** — 允许引用未解析的 source/target，由 CrossLayerLinker 后续修复

### 4.5 ProjectMeta 类型

```typescript
interface ProjectMeta {
  root: string
  frontendFramework: 'next' | 'react' | 'unknown'
  backendFramework: 'trpc' | 'express' | 'unknown'
  databaseType: 'prisma' | 'typeorm' | 'unknown'
  monorepoType: 'turbo' | 'pnpm' | 'nx' | null
  prismaSchemaPath: string | null
  trpcRouterPaths: string[]
  typeormEntityDirs: string[]
  tsConfigPath: string | null
  hasSrcDir: boolean
}
```

---

## 5. 类型系统扩展

### 5.1 拆分 FrameworkType

**文件**：`packages/shared/src/types/graph.ts`

当前 `FrameworkType` 混用前端和后端，需要拆分：

```typescript
// 新增
export type FrontendFramework =
  | 'next'
  | 'react'
  | 'vue'
  | 'nuxt'
  | 'angular'
  | 'svelte'
  | 'sveltekit'
  | 'astro'
  | 'unknown'

export type BackendFramework =
  | 'trpc'
  | 'express'
  | 'nestjs'
  | 'fastify'
  | 'koa'
  | 'hono'
  | 'unknown'

// 扩展 DatabaseType
export type DatabaseType =
  | 'prisma'
  | 'typeorm'
  | 'drizzle'
  | 'sequelize'
  | 'mikro-orm'
  | 'knex'
  | 'unknown'

// 废弃旧类型（或直接删除，因为是内部 API）
// export type FrameworkType = FrontendFramework | BackendFramework
```

### 5.2 扩展 ProjectMeta

```typescript
export interface ProjectMeta {
  root: string
  frontendFramework: FrontendFramework   // 原 FrameworkType
  backendFramework: BackendFramework     // 原 FrameworkType
  databaseType: DatabaseType             // 扩展
  monorepoType: 'turbo' | 'pnpm' | 'nx' | null

  // 已有路径字段
  prismaSchemaPath: string | null
  trpcRouterPaths: string[]
  typeormEntityDirs: string[]
  tsConfigPath: string | null
  hasSrcDir: boolean

  // 新增路径字段
  drizzleSchemaPaths: string[]           // Drizzle schema 文件路径
  nestModuleDirs: string[]               // NestJS 模块目录
}
```

### 5.3 新增节点类型

**文件**：`packages/shared/src/types/node.ts`

```typescript
export type NodeType =
  | 'page'
  | 'component'
  | 'api_route'
  | 'trpc_procedure'
  | 'express_route'
  | 'handler'
  | 'service'
  | 'db_model'
  | 'module'
  | 'controller'    // 新增：NestJS 控制器
  | 'layout'        // 新增：Nuxt/SvelteKit 布局
```

### 5.4 新增 Metadata 接口

```typescript
export interface ControllerMetadata {
  className: string
  basePath: string          // @Controller('users') → '/users'
  methods: Array<{
    name: string
    httpMethod: string      // GET | POST | PUT | DELETE | PATCH
    route: string
    guards: string[]
  }>
}

export interface LayoutMetadata {
  route: string
  childPages: string[]      // 使用此布局的页面
}
```

### 5.5 新增节点颜色

**文件**：`packages/shared/src/constants/nodeColors.ts`

```typescript
export const NODE_COLORS: Record<NodeType, string> = {
  // ... 已有颜色 ...
  controller: '#f97316',  // 橙色 - NestJS 控制器
  layout:     '#a855f7',  // 紫色 - 布局包装器
}

export const NODE_COLORS_ALPHA: Record<NodeType, string> = {
  // ... 已有颜色 ...
  controller: 'rgba(249, 115, 22, 0.15)',
  layout:     'rgba(168, 85, 247, 0.15)',
}
```

---

## 6. 框架检测扩展

### 6.1 autoDetect.ts 修改

**文件**：`packages/cli/src/utils/autoDetect.ts`

#### Phase 1 修改

```typescript
function detectFrontendFramework(
  dependencies: Record<string, string>
): FrontendFramework {
  if (dependencies['next']) return 'next'
  if (dependencies['nuxt']) return 'nuxt'
  if (dependencies['vue']) return 'vue'
  if (dependencies['react']) return 'react'
  return 'unknown'
}

function detectBackendFramework(
  dependencies: Record<string, string>
): BackendFramework {
  if (dependencies['@trpc/server']) return 'trpc'
  if (dependencies['@nestjs/core']) return 'nestjs'
  if (dependencies['express']) return 'express'
  return 'unknown'
}

function detectDatabaseType(
  root: string,
  dependencies: Record<string, string>
): DatabaseType {
  if (findPrismaSchema(root)) return 'prisma'
  if (dependencies['prisma'] || dependencies['@prisma/client']) return 'prisma'
  if (dependencies['typeorm']) return 'typeorm'
  if (dependencies['drizzle-orm']) return 'drizzle'
  return 'unknown'
}
```

#### Phase 2 追加

```typescript
// detectFrontendFramework 追加：
if (dependencies['@angular/core']) return 'angular'
if (dependencies['svelte'] && dependencies['@sveltejs/kit']) return 'sveltekit'
if (dependencies['svelte']) return 'svelte'

// detectBackendFramework 追加：
if (dependencies['fastify']) return 'fastify'
if (dependencies['koa']) return 'koa'
```

#### Phase 3 追加

```typescript
// detectFrontendFramework 追加：
if (dependencies['astro']) return 'astro'

// detectBackendFramework 追加：
if (dependencies['hono']) return 'hono'

// detectDatabaseType 追加：
if (dependencies['sequelize']) return 'sequelize'
if (dependencies['@mikro-orm/core']) return 'mikro-orm'
if (dependencies['knex']) return 'knex'
```

### 6.2 新增检测函数

```typescript
function findDrizzleSchemaPaths(root: string): string[] {
  const candidates = [
    'src/db/schema.ts',
    'db/schema.ts',
    'src/schema.ts',
    'drizzle/schema.ts',
  ]
  return candidates
    .filter(p => fs.existsSync(path.join(root, p)))
    .concat(scanForDrizzleImports(root))
}

function scanForDrizzleImports(root: string): string[] {
  // 扫描所有 .ts 文件，找到 import from 'drizzle-orm' 的文件
  // 返回这些文件的路径
}

function findNestModuleDirs(root: string): string[] {
  // 扫描 *.module.ts 文件，返回其所在目录
  const patterns = ['src/', 'src/modules/']
  // ...
}
```

---

## 7. 文件扫描扩展

### 7.1 扫描扩展名

**文件**：`packages/cli/src/utils/scanDirectory.ts`

```typescript
// 原来
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

// 扩展后
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.astro']
```

### 7.2 动态扫描目录

**文件**：`packages/cli/src/commands/analyze.ts`

```typescript
function getScanDirs(projectMeta: ProjectMeta): string[] {
  const dirs: string[] = [
    'src', 'app', 'src/app',
    'pages', 'src/pages',
    'components', 'src/components',
    'server', 'src/server',
  ]

  // 前端框架特定目录
  if (projectMeta.frontendFramework === 'nuxt') {
    dirs.push('pages', 'layouts', 'server/api', 'server/routes', 'middleware')
  }
  if (projectMeta.frontendFramework === 'vue') {
    dirs.push('src/views', 'src/pages', 'src/layouts')
  }
  if (projectMeta.frontendFramework === 'angular') {
    dirs.push('src/app')
  }
  if (projectMeta.frontendFramework === 'sveltekit') {
    dirs.push('src/routes')
  }
  if (projectMeta.frontendFramework === 'astro') {
    dirs.push('src/pages')
  }

  // 后端框架特定目录
  if (projectMeta.backendFramework === 'nestjs') {
    dirs.push('src/modules', 'src/controllers', 'src/services')
  }

  // 数据库 ORM 特定目录
  if (projectMeta.databaseType === 'drizzle') {
    dirs.push('src/db', 'db', 'drizzle')
  }
  if (projectMeta.databaseType === 'sequelize') {
    dirs.push('models', 'src/models')
  }
  if (projectMeta.databaseType === 'mikro-orm') {
    dirs.push('entities', 'src/entities')
  }
  if (projectMeta.databaseType === 'knex') {
    dirs.push('migrations', 'src/migrations')
  }

  return [...new Set(dirs)]  // 去重
}
```

---

## 8. 解析器设计

### 8.1 VueComponentParser

**文件**：`packages/analyzer/src/parsers/vueComponent.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (!filePath.endsWith('.vue')) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false
  return true
}
```

#### 解析策略

Vue SFC 文件不是 TypeScript，ts-morph 无法直接解析。策略：

1. 读取文件原始文本
2. 正则提取 `<script>` 或 `<script setup>` 块
3. 将 script 块交给 ts-morph 解析
4. 从 `<template>` 块提取子组件引用

```
┌─────────────────────────────────┐
│ <template>                      │
│   <MyButton />   ← 正则提取标签  │
│   <UserProfile />               │
│ </template>                     │
├─────────────────────────────────┤
│ <script setup lang="ts">        │
│   import MyButton from './...'  │ ← ts-morph 解析
│   const props = defineProps()   │
│ </script>                       │
├─────────────────────────────────┤
│ <style scoped>                  │
│   /* 忽略 */                     │
│ </style>                        │
└─────────────────────────────────┘
```

#### 正则模式

```typescript
// 提取 script 块
const SCRIPT_RE = /<script(\s+setup)?(\s+lang="ts")?>([\s\S]*?)<\/script>/

// 提取 template 块
const TEMPLATE_RE = /<template>([\s\S]*?)<\/template>/

// 提取组件标签（PascalCase）
const COMPONENT_TAG_RE = /<([A-Z]\w*)/g

// 提取 defineProps
const DEFINE_PROPS_RE = /defineProps\s*<([^>]+)>/

// 提取 ref/reactive
const STATE_RE = /(?:const|let)\s+(\w+)\s*=\s*(?:ref|reactive)\s*\(/
```

#### 生成的节点和边

```typescript
// 节点
{
  id: 'component:path/to/File.vue:File',
  type: 'component',
  name: 'File',  // 从文件名推导（PascalCase）
  metadata: {
    filePath: 'path/to/File.vue',
    framework: 'vue',
    props: ['title', 'count'],
    usesCompositionAPI: true,
    isScriptSetup: true,
  }
}

// 边
{
  id: 'renders:path/to/File.vue:File→path/to/MyButton.vue:MyButton',
  type: 'renders',
  source: 'component:path/to/File.vue:File',
  target: 'component:path/to/MyButton.vue:MyButton',
  confidence: 'inferred',
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| Vue 2 Options API vs Vue 3 Composition API | 检测 `defineComponent` vs `defineProps` |
| `<script setup>` 无显式组件名 | 从文件名推导（PascalCase） |
| `<component :is="...">` 动态组件 | 跳过，标记 warning |
| kebab-case 模板标签 | 转换为 PascalCase 匹配 |
| 自闭合标签 `<MyButton />` | 正则同时匹配自闭合和开闭标签 |

---

### 8.2 NuxtParser

**文件**：`packages/analyzer/src/parsers/nuxt.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.frontendFramework !== 'nuxt') return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false

  return (
    isUnderDir(filePath, 'pages') ||
    isUnderDir(filePath, 'layouts') ||
    isUnderDir(filePath, 'server/api') ||
    isUnderDir(filePath, 'server/routes') ||
    isUnderDir(filePath, 'middleware')
  )
}
```

#### 路由推导规则

Nuxt 使用文件系统路由，与 Next.js 类似：

```
pages/index.vue           → route: /
pages/about.vue           → route: /about
pages/users/[id].vue      → route: /users/:id
pages/users/[...slug].vue → route: /users/:slug*
pages/[[id]].vue          → route: /:id?
```

#### server/api 路由规则

Nuxt server API 使用 `.method` 后缀约定：

```
server/api/users.get.ts         → GET  /api/users
server/api/users.post.ts        → POST /api/users
server/api/users/[id].delete.ts → DELETE /api/users/:id
server/api/users/[id].put.ts    → PUT  /api/users/:id
```

#### 生成的节点

```typescript
// 页面节点
{
  id: 'page:pages/users/[id].vue:/users/:id',
  type: 'page',
  name: '/users/:id',
  metadata: {
    filePath: 'pages/users/[id].vue',
    framework: 'nuxt',
    isDynamic: true,
    params: ['id'],
  }
}

// API 路由节点
{
  id: 'api_route:server/api/users.get.ts:GET /api/users',
  type: 'api_route',
  name: 'GET /api/users',
  metadata: {
    filePath: 'server/api/users.get.ts',
    method: 'GET',
    route: '/api/users',
    framework: 'nuxt',
  }
}

// 布局节点
{
  id: 'layout:layouts/default.vue:default',
  type: 'layout',
  name: 'default',
  metadata: {
    filePath: 'layouts/default.vue',
    route: '/',
    childPages: [],
  }
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| Nuxt 2 vs Nuxt 3 目录差异 | 优先检测 Nuxt 3 约定 |
| `pages/` 目录不存在（仅用 `app.vue`） | 返回空结果，不报错 |
| 动态路由 `[id]`、`[...slug]`、`[[id]]` | 同 Next.js 解析器处理方式 |
| `server/middleware/`、`server/plugins/` | 不是 API 路由，跳过 |

---

### 8.3 NestjsParser

**文件**：`packages/analyzer/src/parsers/nestjs.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.backendFramework !== 'nestjs') return false
  if (!filePath.endsWith('.ts')) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false

  return (
    filePath.endsWith('.controller.ts') ||
    filePath.endsWith('.service.ts') ||
    filePath.endsWith('.module.ts') ||
    isUnderDir(filePath, 'controllers') ||
    isUnderDir(filePath, 'services') ||
    isUnderDir(filePath, 'modules')
  )
}
```

#### 解析策略

NestJS 大量使用装饰器，与 TypeORM 类似。使用 ts-morph 扫描类声明：

```typescript
// 伪代码
sourceFile.forEachDescendant((node) => {
  if (!Node.isClassDeclaration(node)) return

  const decorators = node.getDecorators()

  // @Controller 装饰器
  const controllerDec = decorators.find(d => d.getName() === 'Controller')
  if (controllerDec) {
    const basePath = extractDecoratorArg(controllerDec) // 'users'
    const controllerNode = createControllerNode(node, basePath)

    // 扫描方法上的 HTTP 装饰器
    node.getMethods().forEach(method => {
      const httpDec = method.getDecorators().find(d =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'All'].includes(d.getName())
      )
      if (httpDec) {
        const route = extractDecoratorArg(httpDec)
        const apiRouteNode = createApiRouteNode(method, basePath, route)
        // ...
      }
    })
  }

  // @Injectable 装饰器
  const injectableDec = decorators.find(d => d.getName() === 'Injectable')
  if (injectableDec) {
    const serviceNode = createServiceNode(node)
  }
})
```

#### 装饰器参数提取

```typescript
// @Controller('users')
// → basePath = 'users'

// @Controller({ path: 'users' })
// → basePath = 'users'

// @Get(':id')
// → route = ':id'

// @Get()  // 无参数
// → route = '/'

// @UseGuards(AuthGuard)
// → guards = ['AuthGuard']
```

#### 生成的节点和边

```typescript
// 控制器节点
{
  id: 'controller:src/users/users.controller.ts:UsersController',
  type: 'controller',
  name: 'UsersController',
  metadata: {
    className: 'UsersController',
    basePath: 'users',
    methods: [
      { name: 'getAll', httpMethod: 'GET', route: '/', guards: [] },
      { name: 'getById', httpMethod: 'GET', route: ':id', guards: [] },
      { name: 'create', httpMethod: 'POST', route: '/', guards: ['AuthGuard'] },
    ],
    filePath: 'src/users/users.controller.ts',
  }
}

// API 路由节点（每个方法一个）
{
  id: 'api_route:src/users/users.controller.ts:GET /users/',
  type: 'api_route',
  name: 'GET /users/',
  metadata: {
    method: 'GET',
    route: 'users/',
    filePath: 'src/users/users.controller.ts',
    framework: 'nestjs',
    guards: [],
  }
}

// 服务节点
{
  id: 'service:src/users/users.service.ts:UsersService',
  type: 'service',
  name: 'UsersService',
  metadata: {
    className: 'UsersService',
    filePath: 'src/users/users.service.ts',
    methods: ['findAll', 'findOne', 'create', 'update', 'remove'],
  }
}

// 边：控制器 → API 路由
{
  id: 'contains:controller:...:UsersController→api_route:...:GET /users/',
  type: 'contains',
  source: 'controller:...',
  target: 'api_route:...',
  confidence: 'certain',
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| `@Get()` 无参数 | 默认路由 `/` |
| `@Get(':id')` 路径参数 | 保留原始路径 |
| `extends BaseController` 继承 | 只解析当前类的方法 |
| `@All` 装饰器 | 生成 `ALL` 方法 |
| `app.setGlobalPrefix('api')` | 无法从控制器文件检测，标记为限制 |
| `@Body`、`@Param`、`@Query` 参数装饰器 | 仅元数据，跳过 |

---

### 8.4 DrizzleParser

**文件**：`packages/analyzer/src/parsers/drizzle.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.databaseType !== 'drizzle') return false
  if (!filePath.endsWith('.ts')) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false

  return (
    filePath.endsWith('schema.ts') ||
    filePath.includes('schema/') ||
    projectMeta.drizzleSchemaPaths.includes(filePath)
  )
}
```

#### 解析策略

Drizzle ORM 使用函数调用定义表：

```typescript
// Drizzle 表定义模式
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Drizzle 关系定义模式
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}))
```

#### ts-morph 解析模式

```typescript
// 查找表定义
sourceFile.forEachDescendant((node) => {
  if (!Node.isCallExpression(node)) return

  const expr = node.getExpression().getText()
  const isTableCall = /^(pg|mysql|sqlite)Table$/.test(expr)

  if (isTableCall) {
    const args = node.getArguments()
    const tableName = (args[0] as StringLiteral).getLiteralValue()
    const columnsObj = args[1] as ObjectLiteralExpression

    const columns = columnsObj.getProperties().map(prop => {
      // 解析 column 定义
      // id: serial('id').primaryKey()
      // → { name: 'id', type: 'serial', isPrimaryKey: true }
    })

    // 创建 db_model 节点
  }

  // 查找关系定义
  if (expr === 'relations') {
    const args = node.getArguments()
    const tableRef = args[0].getText()  // 变量名，如 'users'
    const relationsCallback = args[1]   // ({ many }) => ({ ... })

    // 解析 one() 和 many() 调用
    // 创建 db_relation 边
  }
})
```

#### 支持的数据库方言

| 方言 | 表函数 | 导入来源 |
|------|--------|---------|
| PostgreSQL | `pgTable` | `drizzle-orm/pg-core` |
| MySQL | `mysqlTable` | `drizzle-orm/mysql-core` |
| SQLite | `sqliteTable` | `drizzle-orm/sqlite-core` |

#### 生成的节点和边

```typescript
// 表节点
{
  id: 'db_model:src/db/schema.ts:users',
  type: 'db_model',
  name: 'users',
  metadata: {
    tableName: 'users',
    dialect: 'pg',
    columns: [
      { name: 'id', type: 'serial', isPrimaryKey: true, isNullable: false },
      { name: 'name', type: 'text', isPrimaryKey: false, isNullable: false },
      { name: 'email', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
      { name: 'created_at', type: 'timestamp', isPrimaryKey: false, isNullable: true },
    ],
    filePath: 'src/db/schema.ts',
  }
}

// 关系边
{
  id: 'db_relation:src/db/schema.ts:users→posts',
  type: 'db_relation',
  source: 'db_model:src/db/schema.ts:users',
  target: 'db_model:src/db/schema.ts:posts',
  metadata: {
    type: 'one_to_many',
    sourceField: 'id',
    targetField: 'authorId',
    confidence: 'certain',
  }
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| 不同方言 `pgTable`/`mysqlTable`/`sqliteTable` | 正则匹配所有方言 |
| `.references(() => otherTable.id)` 外键 | 提取为关系边 |
| 复合主键 | 记录多个主键列 |
| `pgSchema('my_schema').table(...)` 嵌套调用 | 处理嵌套调用表达式 |
| `relations()` 引用其他文件的表 | 通过变量名推断 |
| 表分散在多个文件 | 跨文件收集后再建立关系 |

---

### 8.5 AngularParser（Phase 2）

**文件**：`packages/analyzer/src/parsers/angular.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.frontendFramework !== 'angular') return false
  if (!filePath.endsWith('.ts')) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false  // *.spec.ts

  return (
    filePath.endsWith('.component.ts') ||
    filePath.endsWith('.module.ts') ||
    filePath.endsWith('.routing.ts') ||
    filePath.endsWith('-routing.module.ts')
  )
}
```

#### 解析策略

Angular 使用装饰器，与 NestJS 类似（NestJS 借鉴了 Angular 的模式）：

```typescript
// @Component 装饰器
@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent { }

// @NgModule 装饰器
@NgModule({
  declarations: [UserListComponent, UserDetailComponent],
  imports: [CommonModule, UserRoutingModule],
  providers: [UserService]
})
export class UserModule { }

// 路由定义
const routes: Routes = [
  { path: '', component: UserListComponent },
  { path: ':id', component: UserDetailComponent },
  { path: 'new', component: UserCreateComponent, canActivate: [AuthGuard] },
]
```

#### 生成的节点

```typescript
// 组件节点
{
  id: 'component:src/app/users/user-list.component.ts:UserListComponent',
  type: 'component',
  name: 'UserListComponent',
  metadata: {
    selector: 'app-user-list',
    templateUrl: './user-list.component.html',
    filePath: 'src/app/users/user-list.component.ts',
    framework: 'angular',
    isStandalone: false,
  }
}

// 页面节点（从路由定义提取）
{
  id: 'page:src/app/users/user-routing.module.ts:/users/:id',
  type: 'page',
  name: '/users/:id',
  metadata: {
    filePath: 'src/app/users/user-routing.module.ts',
    route: '/users/:id',
    component: 'UserDetailComponent',
    canActivate: [],
  }
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| Angular 14+ Standalone Components | 检测 `standalone: true` |
| `loadChildren` 懒加载 | 记录模块路径，无法解析内部路由 |
| 多模块 Feature Modules | 每个模块独立解析 |
| `app.component.ts` 根组件 | 始终存在，正常解析 |

---

### 8.6 SvelteComponentParser（Phase 2）

**文件**：`packages/analyzer/src/parsers/svelteComponent.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (!filePath.endsWith('.svelte')) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false
  return true
}
```

#### 解析策略

与 VueComponentParser 类似，正则提取 `<script>` 块：

```svelte
<script>
  import MyButton from './MyButton.svelte'
  export let title    // props
  let count = 0       // state
</script>

<h1>{title}</h1>
<MyButton {count} />
```

```typescript
// 正则模式
const SCRIPT_RE = /<script(\s+context="module")?>([\s\S]*?)<\/script>/
const TEMPLATE_RE = /(?<=<\/script>)([\s\S]*?)(?=<style|$)/
const COMPONENT_TAG_RE = /<([A-Z]\w*)/g
const PROP_RE = /export\s+let\s+(\w+)/g
```

#### 生成的节点和边

```typescript
// 组件节点
{
  id: 'component:src/lib/Counter.svelte:Counter',
  type: 'component',
  name: 'Counter',
  metadata: {
    filePath: 'src/lib/Counter.svelte',
    framework: 'svelte',
    props: ['title'],
    usesRunes: false,  // Svelte 5
  }
}

// renders 边
{
  type: 'renders',
  source: 'component:src/lib/Counter.svelte:Counter',
  target: 'component:src/lib/MyButton.svelte:MyButton',
  confidence: 'inferred',
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| `{#if}`、`{#each}`、`{#await}` 控制流 | 正常提取内部组件 |
| `<svelte:component this={...}>` 动态组件 | 跳过，标记 warning |
| `context="module"` 脚本 | 解析但标记为共享状态 |
| Svelte 5 runes `$state`、`$props` | 检测并标记 `usesRunes: true` |

---

### 8.7 SvelteKitParser（Phase 2）

**文件**：`packages/analyzer/src/parsers/sveltekit.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.frontendFramework !== 'sveltekit') return false
  if (!filePath.includes('src/routes')) return false
  if (filePath.includes('node_modules')) return false

  const basename = path.basename(filePath)
  return (
    basename.startsWith('+page') ||
    basename.startsWith('+layout') ||
    basename.startsWith('+server')
  )
}
```

#### SvelteKit 文件约定

```
src/routes/
  +page.svelte          → 页面
  +page.ts              → 页面数据加载
  +page.server.ts       → 服务端数据加载
  +layout.svelte        → 布局
  +layout.ts            → 布局数据加载
  +layout.server.ts     → 服务端布局数据加载
  +server.ts            → API 端点

src/routes/users/
  [id]/
    +page.svelte        → /users/:id 页面
  +server.ts            → /users API 端点
```

#### +server.ts 解析

```typescript
// SvelteKit API 端点导出命名函数
export async function GET({ url }) { ... }
export async function POST({ request }) { ... }
export async function PUT({ request, params }) { ... }
export async function DELETE({ params }) { ... }
```

与 Next.js `route.ts` 模式相同，检测导出的 HTTP 方法函数。

#### 生成的节点

```typescript
// 页面节点
{
  id: 'page:src/routes/users/[id]/+page.svelte:/users/:id',
  type: 'page',
  name: '/users/:id',
  metadata: {
    filePath: 'src/routes/users/[id]/+page.svelte',
    framework: 'sveltekit',
    params: ['id'],
  }
}

// API 路由节点
{
  id: 'api_route:src/routes/users/+server.ts:GET /users',
  type: 'api_route',
  name: 'GET /users',
  metadata: {
    method: 'GET',
    route: '/users',
    filePath: 'src/routes/users/+server.ts',
    framework: 'sveltekit',
  }
}

// 布局节点
{
  id: 'layout:src/routes/+layout.svelte:root',
  type: 'layout',
  name: 'root',
  metadata: {
    filePath: 'src/routes/+layout.svelte',
    route: '/',
  }
}
```

---

### 8.8 FastifyParser（Phase 2）

**文件**：`packages/analyzer/src/parsers/fastify.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.backendFramework !== 'fastify') return false
  if (!filePath.match(/\.(ts|js)$/)) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false

  return (
    isUnderDir(filePath, 'routes') ||
    isUnderDir(filePath, 'plugins') ||
    /route|plugin/i.test(path.basename(filePath))
  )
}
```

#### 解析策略

Fastify 路由模式与 Express 非常相似：

```typescript
// 简写模式
fastify.get('/users', async (request, reply) => { ... })
fastify.post('/users', async (request, reply) => { ... })

// 对象模式
fastify.route({
  method: 'GET',
  url: '/users/:id',
  handler: async (request, reply) => { ... }
})

// 插件注册 + 前缀
fastify.register(userRoutes, { prefix: '/api/users' })
```

#### ts-morph 解析

复用 ExpressParser 的模式，额外处理：

```typescript
// 查找 fastify.register() 调用
if (expr === 'register' && isFastifyInstance(obj)) {
  const opts = args[1] as ObjectLiteralExpression
  const prefix = opts.getProperty('prefix')
  // 记录前缀
}
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| `fastify.register()` + `prefix` 选项 | 记录前缀，拼接到子路由 |
| 简写 vs 对象风格路由 | 两种都解析 |
| Schema 定义 | 仅元数据，不解析 |

---

### 8.9 KoaParser（Phase 2）

**文件**：`packages/analyzer/src/parsers/koa.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.backendFramework !== 'koa') return false
  if (!filePath.match(/\.(ts|js)$/)) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false

  return (
    isUnderDir(filePath, 'routes') ||
    /route|router/i.test(path.basename(filePath))
  )
}
```

#### 解析策略

Koa 通常使用 `koa-router` 或 `@koa/router`：

```typescript
const Router = require('koa-router')  // 或 import Router from '@koa/router'
const router = new Router()

router.get('/users', ctx => { ... })
router.post('/users', ctx => { ... })
router.prefix('/api')

// 嵌套路由
const subRouter = new Router()
subRouter.get('/:id', ctx => { ... })
router.use('/users', subRouter.routes())
```

#### ts-morph 解析

```typescript
// 查找 new Router() 调用
sourceFile.forEachDescendant((node) => {
  if (Node.isNewExpression(node)) {
    const expr = node.getExpression().getText()
    if (expr === 'Router') {
      // 跟踪变量名
      const varName = node.getParent()?.getName()
      // 后续查找 varName.get()、varName.post() 等
    }
  }
})
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| `@koa/router` vs `koa-router` | 两种包名都识别 |
| `router.prefix('/api')` | 记录前缀 |
| 嵌套路由 `router.use('/prefix', subRouter.routes())` | 递归解析子路由 |

---

### 8.10 AstroParser（Phase 3）

**文件**：`packages/analyzer/src/parsers/astro.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.frontendFramework !== 'astro') return false
  if (!filePath.endsWith('.astro')) return false
  if (!filePath.includes('src/pages')) return false
  return true
}
```

#### 路由推导

Astro 使用文件系统路由：

```
src/pages/index.astro           → /
src/pages/about.astro           → /about
src/pages/blog/[slug].astro     → /blog/:slug
src/pages/[...rest].astro       → /:rest*
```

`.md` 和 `.mdx` 文件在 `src/pages/` 中也成为路由。

#### 生成的节点

```typescript
{
  id: 'page:src/pages/blog/[slug].astro:/blog/:slug',
  type: 'page',
  name: '/blog/:slug',
  metadata: {
    filePath: 'src/pages/blog/[slug].astro',
    framework: 'astro',
    params: ['slug'],
  }
}
```

---

### 8.11 SequelizeParser（Phase 3）

**文件**：`packages/analyzer/src/parsers/sequelize.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.databaseType !== 'sequelize') return false
  if (!filePath.match(/\.(ts|js)$/)) return false
  if (filePath.includes('node_modules')) return false

  return (
    isUnderDir(filePath, 'models') ||
    filePath.endsWith('.model.ts') ||
    filePath.endsWith('.model.js')
  )
}
```

#### 两种定义模式

```typescript
// 模式 1：Model.init()
class User extends Model<UserAttributes> {}
User.init(
  { name: DataTypes.STRING, email: DataTypes.STRING },
  { sequelize, tableName: 'users' }
)

// 模式 2：sequelize.define()
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
})

// 关联
User.hasMany(Post)
Post.belongsTo(User)
User.belongsToMany(Role, { through: 'UserRoles' })
```

#### 生成的节点和边

```typescript
// db_model 节点
{
  id: 'db_model:src/models/user.ts:User',
  type: 'db_model',
  name: 'User',
  metadata: {
    tableName: 'users',
    columns: [
      { name: 'name', type: 'STRING' },
      { name: 'email', type: 'STRING' },
    ],
    filePath: 'src/models/user.ts',
  }
}

// db_relation 边
{
  type: 'db_relation',
  source: 'db_model:src/models/user.ts:User',
  target: 'db_model:src/models/post.ts:Post',
  metadata: { type: 'one_to_many', association: 'hasMany' }
}
```

---

### 8.12 MikroOrmParser（Phase 3）

**文件**：`packages/analyzer/src/parsers/mikroOrm.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.databaseType !== 'mikro-orm') return false
  if (!filePath.endsWith('.ts')) return false
  if (filePath.includes('node_modules')) return false

  return (
    isUnderDir(filePath, 'entities') ||
    filePath.endsWith('.entity.ts')
  )
}
```

#### 解析策略

MikroORM 使用装饰器，与 TypeORM 几乎相同：

```typescript
@Entity()
export class User {
  @PrimaryKey()
  id!: number

  @Property()
  name!: string

  @OneToMany(() => Post, post => post.author)
  posts = new Collection<Post>(this)

  @ManyToOne(() => Company)
  company!: Company
}
```

复用 TypeormParser 的装饰器扫描逻辑。

---

### 8.13 KnexParser（Phase 3）

**文件**：`packages/analyzer/src/parsers/knex.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.databaseType !== 'knex') return false
  if (!filePath.match(/\.(ts|js)$/)) return false
  if (filePath.includes('node_modules')) return false

  return (
    isUnderDir(filePath, 'migrations') ||
    filePath.endsWith('knexfile.ts') ||
    filePath.endsWith('knexfile.js')
  )
}
```

#### 解析策略

Knex 使用迁移文件定义表结构：

```typescript
exports.up = function(knex) {
  return knex.schema.createTable('users', table => {
    table.increments('id')
    table.string('name').notNullable()
    table.string('email').unique()
    table.timestamps(true, true)
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('users')
}
```

#### ts-morph 解析

```typescript
// 查找 knex.schema.createTable() 调用
sourceFile.forEachDescendant((node) => {
  if (!Node.isCallExpression(node)) return

  const expr = node.getExpression()
  if (expr.getText() === 'createTable') {
    const args = node.getArguments()
    const tableName = (args[0] as StringLiteral).getLiteralValue()
    const callback = args[1] as ArrowFunction

    // 解析 callback 中的 table.xxx() 调用
    callback.forEachDescendant((tableCall) => {
      if (Node.isCallExpression(tableCall)) {
        const method = tableCall.getExpression().getText()
        // increments, string, integer, boolean, timestamp, etc.
      }
    })
  }
})
```

#### 边界情况

| 情况 | 处理方式 |
|------|---------|
| `createTable` vs `alterTable` | 两种都解析 |
| 一个迁移文件定义多个表 | 遍历所有 `createTable` 调用 |
| `table.increments('id')` 列类型 | 提取方法名作为类型 |

---

### 8.14 HonoParser（Phase 3）

**文件**：`packages/analyzer/src/parsers/hono.ts`

#### canHandle 逻辑

```typescript
canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
  if (projectMeta.backendFramework !== 'hono') return false
  if (!filePath.match(/\.(ts|js)$/)) return false
  if (filePath.includes('node_modules')) return false
  if (isTestFile(filePath)) return false

  return (
    isUnderDir(filePath, 'routes') ||
    isUnderDir(filePath, 'api') ||
    /route/i.test(path.basename(filePath))
  )
}
```

#### 解析策略

Hono 路由模式与 Express/Fastify 相似：

```typescript
import { Hono } from 'hono'
const app = new Hono()

app.get('/users', (c) => { ... })
app.post('/users', async (c) => { ... })

// 子路由
const api = new Hono()
api.route('/users', userRoutes)
app.route('/api', api)
```

复用 ExpressParser/FastifyParser 的模式，额外处理 `app.route()` 子路由组合。

---

## 9. 跨层连线扩展

### 9.1 CrossLayerLinker 修改

**文件**：`packages/analyzer/src/resolver/crossLayer.ts`

#### Phase 1：Drizzle DB 调用模式

在 `scanFileForDbCalls` 方法中添加 Drizzle 模式：

```typescript
// Drizzle 模式 1：标准查询 API
// db.select().from(users).where(...)
// db.insert(users).values(...)
// db.update(users).set(...)
// db.delete(users).where(...)
const DRIZZLE_QUERY_RE = /(?:db|this\.db)\s*\.\s*(?:select|insert|update|delete)\s*\([^)]*\)\s*\.\s*from\s*\(\s*(\w+)\s*\)/g

// Drizzle 模式 2：关系查询 API
// db.query.users.findMany(...)
// db.query.posts.findFirst(...)
const DRIZZLE_RELATIONAL_RE = /db\s*\.\s*query\s*\.\s*(\w+)\s*\.\s*(?:findMany|findFirst|findUnique|create|update|delete)/g
```

#### Phase 2：NestJS 服务注入

在 `linkCallsService` 方法中检测 NestJS 构造函数注入：

```typescript
// constructor(private readonly userService: UserService)
const NESTJS_INJECT_RE = /constructor\s*\([^)]*(?:private|protected|public)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)\s*\)/g
```

#### Phase 3：其他 ORM DB 调用模式

```typescript
// Sequelize
// User.findAll(), User.create(), User.findByPk()
const SEQUELIZE_RE = /(\w+)\s*\.\s*(?:findAll|findOne|findByPk|create|update|destroy|bulkCreate)\s*\(/g

// MikroORM
// em.find(User, ...), em.persistAndFlush(user)
const MIKRO_ORM_RE = /(?:em|this\.em)\s*\.\s*(?:find|findOne|persistAndFlush|removeAndFlush)\s*\(\s*(\w+)/g

// Knex
// knex('users').select(), knex('users').insert()
const KNEX_RE = /knex\s*\(\s*['"](\w+)['"]\s*\)\s*\.\s*(?:select|insert|update|delete)/g
```

---

## 10. 解析器注册集中化

### 10.1 工厂函数

**文件**：`packages/analyzer/src/parsers/index.ts`

```typescript
import { Parser } from '@omnivis/shared'
import { PrismaParser } from './prisma'
import { NextjsAppParser } from './nextjsApp'
import { NextjsPagesParser } from './nextjsPages'
import { TrpcParser } from './trpc'
import { ExpressParser } from './express'
import { TypeormParser } from './typeorm'
import { ApiCallsParser } from './apiCalls'
import { ReactComponentParser } from './reactComponent'
// Phase 1
import { VueComponentParser } from './vueComponent'
import { NuxtParser } from './nuxt'
import { NestjsParser } from './nestjs'
import { DrizzleParser } from './drizzle'
// Phase 2
import { AngularParser } from './angular'
import { SvelteComponentParser } from './svelteComponent'
import { SvelteKitParser } from './sveltekit'
import { FastifyParser } from './fastify'
import { KoaParser } from './koa'
// Phase 3
import { AstroParser } from './astro'
import { SequelizeParser } from './sequelize'
import { MikroOrmParser } from './mikroOrm'
import { KnexParser } from './knex'
import { HonoParser } from './hono'

export function createDefaultParsers(): Parser[] {
  return [
    // 已有
    new PrismaParser(),
    new NextjsAppParser(),
    new NextjsPagesParser(),
    new TrpcParser(),
    new ExpressParser(),
    new TypeormParser(),
    new ApiCallsParser(),
    new ReactComponentParser(),
    // Phase 1
    new VueComponentParser(),
    new NuxtParser(),
    new NestjsParser(),
    new DrizzleParser(),
    // Phase 2
    new AngularParser(),
    new SvelteComponentParser(),
    new SvelteKitParser(),
    new FastifyParser(),
    new KoaParser(),
    // Phase 3
    new AstroParser(),
    new SequelizeParser(),
    new MikroOrmParser(),
    new KnexParser(),
    new HonoParser(),
  ]
}
```

### 10.2 CLI 命令修改

**修改文件**：`packages/cli/src/commands/analyze.ts`、`serve.ts`、`check.ts`

```typescript
// 原来（三处重复）
builder.registerParsers([
  new PrismaParser(),
  new NextjsAppParser(),
  // ... 8 个解析器
])

// 改为
import { createDefaultParsers } from '@omnivis/analyzer'
builder.registerParsers(createDefaultParsers())
```

---

## 11. 测试策略

### 11.1 测试文件命名

```
packages/analyzer/__tests__/parsers/
  vueComponent.test.ts
  nuxt.test.ts
  nestjs.test.ts
  drizzle.test.ts
  angular.test.ts
  svelteComponent.test.ts
  sveltekit.test.ts
  fastify.test.ts
  koa.test.ts
  astro.test.ts
  sequelize.test.ts
  mikroOrm.test.ts
  knex.test.ts
  hono.test.ts
```

### 11.2 Fixture 目录结构

```
packages/analyzer/__tests__/fixtures/
  vue/
    Button.vue
    App.vue
    Empty.vue
  nuxt/
    pages/
      index.vue
      users/[id].vue
    layouts/
      default.vue
    server/
      api/
        users.get.ts
        users.post.ts
  nestjs/
    users.controller.ts
    users.service.ts
    users.module.ts
    empty.controller.ts
  drizzle/
    schema.ts
    relations.ts
    empty.ts
  angular/
    user-list.component.ts
    app-routing.module.ts
    user.module.ts
  svelte/
    Button.svelte
    App.svelte
  sveltekit/
    src/routes/
      +page.svelte
      +layout.svelte
      users/[id]/
        +page.svelte
      api/
        +server.ts
  fastify/
    routes.ts
    plugins.ts
  koa/
    router.ts
  astro/
    src/pages/
      index.astro
      blog/[slug].astro
  sequelize/
    user.model.ts
    post.model.ts
  mikroOrm/
    user.entity.ts
    post.entity.ts
  knex/
    migrations/
      001_create_users.ts
  hono/
    routes.ts
```

### 11.3 每个解析器的最低测试要求

| 测试类型 | 描述 | 示例 |
|---------|------|------|
| 正常输入 | 有效的 fixture 文件 | Vue 组件有 script + template → 正确的 component + renders |
| 异常输入 | 空文件、不存在的文件、格式错误 | 空 .vue 文件 → 空结果 + warning |
| 边界情况 | 特殊模式 | `<script setup>` 无组件名 → 从文件名推导 |

### 11.4 测试模板

```typescript
import { describe, it, expect } from 'vitest'
import { VueComponentParser } from '../../src/parsers/vueComponent'
import { ProjectMeta } from '@omnivis/shared'
import * as path from 'path'

const FIXTURES = path.join(__dirname, '../fixtures/vue')

const baseMeta: ProjectMeta = {
  root: FIXTURES,
  frontendFramework: 'vue',
  backendFramework: 'unknown',
  databaseType: 'unknown',
  // ... 其他字段
}

describe('VueComponentParser', () => {
  const parser = new VueComponentParser()

  describe('canHandle', () => {
    it('should handle .vue files', () => {
      expect(parser.canHandle('Button.vue', baseMeta)).toBe(true)
    })

    it('should not handle .ts files', () => {
      expect(parser.canHandle('utils.ts', baseMeta)).toBe(false)
    })

    it('should not handle test files', () => {
      expect(parser.canHandle('Button.spec.vue', baseMeta)).toBe(false)
    })

    it('should not handle node_modules', () => {
      expect(parser.canHandle('node_modules/lib/Button.vue', baseMeta)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should extract component and renders edges', async () => {
      const result = await parser.parse(
        path.join(FIXTURES, 'App.vue'),
        { projectMeta: baseMeta }
      )

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe('component')
      expect(result.nodes[0].name).toBe('App')
      expect(result.edges.length).toBeGreaterThan(0)
      expect(result.edges[0].type).toBe('renders')
      expect(result.errors).toHaveLength(0)
    })

    it('should handle empty file gracefully', async () => {
      const result = await parser.parse(
        path.join(FIXTURES, 'Empty.vue'),
        { projectMeta: baseMeta }
      )

      expect(result.nodes).toHaveLength(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].severity).toBe('warning')
    })

    it('should infer component name from filename for script setup', async () => {
      const result = await parser.parse(
        path.join(FIXTURES, 'Button.vue'),
        { projectMeta: baseMeta }
      )

      expect(result.nodes[0].name).toBe('Button')
    })
  })
})
```

---

## 12. 实施计划

### Phase 1：Vue/Nuxt + NestJS + Drizzle

```
Step 1:  类型系统扩展（shared 包）
Step 2:  autoDetect 扩展（cli 包）
Step 3:  文件扫描扩展（scanDirectory.ts）
Step 4:  VueComponentParser 实现 + 测试
Step 5:  NuxtParser 实现 + 测试
Step 6:  NestjsParser 实现 + 测试
Step 7:  DrizzleParser 实现 + 测试
Step 8:  CrossLayerLinker 更新（Drizzle 模式）
Step 9:  解析器注册集中化
Step 10: 集成测试 + 文档更新
```

### Phase 2：Angular + Svelte/SvelteKit + Fastify/Koa

```
Step 1:  autoDetect 追加 Phase 2 框架
Step 2:  AngularParser 实现 + 测试
Step 3:  SvelteComponentParser 实现 + 测试
Step 4:  SvelteKitParser 实现 + 测试
Step 5:  FastifyParser 实现 + 测试
Step 6:  KoaParser 实现 + 测试
Step 7:  scanDirectory 追加 .svelte 扩展名
Step 8:  集成测试
```

### Phase 3：Astro + Sequelize/MikroORM/Knex + Hono

```
Step 1:  autoDetect 追加 Phase 3 框架
Step 2:  AstroParser 实现 + 测试
Step 3:  SequelizeParser 实现 + 测试
Step 4:  MikroOrmParser 实现 + 测试
Step 5:  KnexParser 实现 + 测试
Step 6:  HonoParser 实现 + 测试
Step 7:  scanDirectory 追加 .astro 扩展名
Step 8:  CrossLayerLinker 追加 Sequelize/MikroORM/Knex 模式
Step 9:  集成测试 + 性能测试
```

### 依赖关系

```
Phase 1 Step 1 (类型系统)
  ↓
Phase 1 Step 2-9 (Phase 1 功能)
  ↓
Phase 2 Step 1-8 (Phase 2 功能)  ← 仅依赖 Phase 1 的类型变更
  ↓
Phase 3 Step 1-9 (Phase 3 功能)  ← 仅依赖 Phase 2 的类型变更
```

Phase 内部各解析器互相独立，可并行开发。

---

## 13. 关键文件清单

### 需要修改的文件

| 文件 | 修改内容 | Phase |
|------|---------|-------|
| `packages/shared/src/types/graph.ts` | 拆分 FrameworkType，扩展 DatabaseType，扩展 ProjectMeta | 1 |
| `packages/shared/src/types/node.ts` | 添加 controller、layout 节点类型和 Metadata | 1 |
| `packages/shared/src/constants/nodeColors.ts` | 添加新节点颜色 | 1 |
| `packages/shared/src/index.ts` | 导出新类型 | 1 |
| `packages/cli/src/utils/autoDetect.ts` | 扩展框架检测 | 1,2,3 |
| `packages/cli/src/utils/scanDirectory.ts` | 扩展文件扩展名 | 1,2,3 |
| `packages/analyzer/src/parsers/index.ts` | 添加 createDefaultParsers() | 1 |
| `packages/analyzer/src/resolver/crossLayer.ts` | 添加 DB 调用模式 | 1,3 |
| `packages/cli/src/commands/analyze.ts` | 动态 scanDirs + 工厂函数 | 1 |
| `packages/cli/src/commands/serve.ts` | 同上 | 1 |
| `packages/cli/src/commands/check.ts` | 同上 | 1 |

### 需要新建的文件

| 文件 | Phase |
|------|-------|
| `packages/analyzer/src/parsers/vueComponent.ts` | 1 |
| `packages/analyzer/src/parsers/nuxt.ts` | 1 |
| `packages/analyzer/src/parsers/nestjs.ts` | 1 |
| `packages/analyzer/src/parsers/drizzle.ts` | 1 |
| `packages/analyzer/src/parsers/angular.ts` | 2 |
| `packages/analyzer/src/parsers/svelteComponent.ts` | 2 |
| `packages/analyzer/src/parsers/sveltekit.ts` | 2 |
| `packages/analyzer/src/parsers/fastify.ts` | 2 |
| `packages/analyzer/src/parsers/koa.ts` | 2 |
| `packages/analyzer/src/parsers/astro.ts` | 3 |
| `packages/analyzer/src/parsers/sequelize.ts` | 3 |
| `packages/analyzer/src/parsers/mikroOrm.ts` | 3 |
| `packages/analyzer/src/parsers/knex.ts` | 3 |
| `packages/analyzer/src/parsers/hono.ts` | 3 |
| `packages/analyzer/__tests__/parsers/vueComponent.test.ts` | 1 |
| `packages/analyzer/__tests__/parsers/nuxt.test.ts` | 1 |
| `packages/analyzer/__tests__/parsers/nestjs.test.ts` | 1 |
| `packages/analyzer/__tests__/parsers/drizzle.test.ts` | 1 |
| `packages/analyzer/__tests__/parsers/angular.test.ts` | 2 |
| `packages/analyzer/__tests__/parsers/svelteComponent.test.ts` | 2 |
| `packages/analyzer/__tests__/parsers/sveltekit.test.ts` | 2 |
| `packages/analyzer/__tests__/parsers/fastify.test.ts` | 2 |
| `packages/analyzer/__tests__/parsers/koa.test.ts` | 2 |
| `packages/analyzer/__tests__/parsers/astro.test.ts` | 3 |
| `packages/analyzer/__tests__/parsers/sequelize.test.ts` | 3 |
| `packages/analyzer/__tests__/parsers/mikroOrm.test.ts` | 3 |
| `packages/analyzer/__tests__/parsers/knex.test.ts` | 3 |
| `packages/analyzer/__tests__/parsers/hono.test.ts` | 3 |
| `packages/analyzer/__tests__/fixtures/` 各子目录 | 1,2,3 |

---

## 14. 验证方式

### 14.1 单元测试

```bash
# 运行所有测试
pnpm test

# 运行单个解析器测试
pnpm --filter @omnivis/analyzer test -- vueComponent
```

每个解析器至少 3 个测试用例。

### 14.2 集成测试

创建一个包含多种框架的 fixture 项目：

```
fixtures/multi-framework/
  package.json          → 包含 vue, @nestjs/core, drizzle-orm 依赖
  src/
    pages/              → Nuxt 页面
    server/api/         → Nuxt API
    modules/            → NestJS 模块
    db/schema.ts        → Drizzle schema
    components/         → Vue 组件
```

运行 `autoDetectProject` 验证检测正确性。

### 14.3 端到端测试

```bash
# 对 demo/ 目录运行分析
pnpm --filter @omnivis/cli dev serve

# 在浏览器中验证：
# 1. 新节点类型（controller, layout）正确显示
# 2. 新框架的路由正确识别
# 3. 跨层连线正确建立
```

### 14.4 构建验证

```bash
pnpm build  # 确保所有包编译通过
```

### 14.5 性能验证

扩展后解析器数量从 8 增加到 22，需要验证：

- 单文件解析仍 < 100ms
- 100 文件项目仍 < 10 秒
- `canHandle()` 快速拒绝不匹配的文件

---

## 附录 A：技术选型决策记录

### A.1 为什么不用插件系统？

**决策**：保持静态注册，不引入插件系统。

**理由**：
1. `canHandle()` 分派模式已经足够扩展
2. 22 个解析器的规模不需要动态加载
3. 插件系统增加复杂度但无实际收益
4. 未使用的解析器 `canHandle()` 快速返回 `false`，开销可忽略

### A.2 为什么用正则而不是 @vue/compiler-sfc？

**决策**：Vue/Svelte/Astro 文件用正则提取 `<script>` 块，不用官方编译器。

**理由**：
1. 不引入额外重依赖
2. 解析目标是架构结构（组件关系、路由），不是编译
3. 正则提取 script 块 + ts-morph 解析足够
4. 遵循"降级不崩溃"原则

### A.3 为什么新增 controller 和 layout 节点类型？

**决策**：新增 2 个节点类型，而不是复用 api_route 和 page。

**理由**：
1. NestJS Controller 按类分组端点，与扁平 api_route 语义不同
2. Nuxt/SvelteKit Layout 包裹页面，定义共享 UI 结构
3. 可视化时需要不同颜色和形状区分
4. 保持最小扩展，不为每个框架创建新类型

---

## 附录 B：术语表

| 术语 | 定义 |
|------|------|
| Parser | 实现 `Parser` 接口的解析器类 |
| canHandle | 解析器的门控方法，决定是否处理某文件 |
| CrossLayerLinker | 跨层连线器，连接前端、后端、数据库层 |
| ProjectMeta | 项目元数据，包含检测到的框架信息 |
| SFC | Single File Component（Vue/Svelte 单文件组件） |
| 路由推导 | 从文件路径推导 URL 路由 |
| 装饰器扫描 | 用 ts-morph 扫描 TypeScript 装饰器 |
