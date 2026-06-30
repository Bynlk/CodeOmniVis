/**
 * 配置文件加载器
 *
 * 加载 .codeomnivis.json 配置文件，与默认值合并。
 * 遵循“降级而非崩溃”原则：配置文件不存在、解析失败或字段非法时，
 * 逐字段回退到默认值，绝不让非法输入流向下游消费者。
 */

import * as fs from 'fs'
import * as path from 'path'
import { isJsonObject } from '../types/json'
import type { JsonObject } from '../types/json'
import type { CodeOmniVisConfig } from '../types/config'

const CONFIG_FILENAME = '.codeomnivis.json'

const FRONTEND_FRAMEWORKS: ReadonlyArray<NonNullable<NonNullable<CodeOmniVisConfig['frontend']>['framework']>> = [
  'next',
  'react',
  'vue',
  'auto',
]
const BACKEND_FRAMEWORKS: ReadonlyArray<NonNullable<NonNullable<CodeOmniVisConfig['backend']>['framework']>> = [
  'express',
  'trpc',
  'tsrpc',
  'fastify',
  'auto',
]
const UI_THEMES: ReadonlyArray<NonNullable<NonNullable<CodeOmniVisConfig['ui']>['theme']>> = ['dark', 'light']
const UI_LAYOUTS: ReadonlyArray<NonNullable<NonNullable<CodeOmniVisConfig['ui']>['layout']>> = ['dagre', 'grid', 'circle']

/** 仅当值为有限正整数时返回它,否则返回 undefined(丢弃非法端口/深度/阈值)。 */
function asPositiveInt(value: JsonObject[string] | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/** 仅当值为布尔时返回它,否则 undefined。 */
function asBoolean(value: JsonObject[string] | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/** 把值收敛为字符串数组:仅保留其中的字符串元素;非数组返回 undefined。 */
function asStringArray(value: JsonObject[string] | undefined): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

/** 当值是被允许的字面量之一时返回它,否则 undefined。 */
function asEnum<T extends string>(value: JsonObject[string] | undefined, allowed: ReadonlyArray<T>): T | undefined {
  if (typeof value !== 'string') return undefined
  return allowed.find(option => option === value)
}

/**
 * 加载项目配置
 * 优先级：.codeomnivis.json > 默认值
 */
export function loadConfig(projectRoot: string): CodeOmniVisConfig {
  const configPath = path.join(projectRoot, CONFIG_FILENAME)

  if (!fs.existsSync(configPath)) {
    return getDefaultConfig(projectRoot)
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (!isJsonObject(parsed)) {
      return getDefaultConfig(projectRoot)
    }
    return mergeWithDefaults(parsed, projectRoot)
  } catch (err) {
    console.warn(`[codeomnivis] Failed to parse ${CONFIG_FILENAME}: ${err}. Using defaults.`)
    return getDefaultConfig(projectRoot)
  }
}

/**
 * 获取默认配置
 */
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

/**
 * 将用户配置(已确认为 JSON 对象)与默认值逐字段安全合并。
 *
 * E-11 · F14:旧实现 `...partial` 整体展开,任何非法嵌套字段(如 port: "abc"、
 * frontend.dirs: "src"、非法 framework)都会原样污染下游。这里改为对每个字段做
 * 类型 / 枚举校验,非法值丢弃并回退到默认,从而保证返回结构始终合法。
 */
function mergeWithDefaults(partial: JsonObject, projectRoot: string): CodeOmniVisConfig {
  const defaults = getDefaultConfig(projectRoot)

  const frontendRaw = isJsonObject(partial.frontend) ? partial.frontend : {}
  const backendRaw = isJsonObject(partial.backend) ? partial.backend : {}
  const databaseRaw = isJsonObject(partial.database) ? partial.database : {}
  const parserRaw = isJsonObject(partial.parser) ? partial.parser : undefined
  const uiRaw = isJsonObject(partial.ui) ? partial.ui : undefined

  const config: CodeOmniVisConfig = {
    root: typeof partial.root === 'string' ? partial.root : defaults.root,
    frontend: {
      dirs: asStringArray(frontendRaw.dirs) ?? defaults.frontend?.dirs ?? [],
      framework: asEnum(frontendRaw.framework, FRONTEND_FRAMEWORKS) ?? defaults.frontend?.framework ?? 'auto',
    },
    backend: {
      dirs: asStringArray(backendRaw.dirs) ?? defaults.backend?.dirs ?? [],
      framework: asEnum(backendRaw.framework, BACKEND_FRAMEWORKS) ?? defaults.backend?.framework ?? 'auto',
    },
    database: {},
    exclude: asStringArray(partial.exclude) ?? defaults.exclude,
    port: asPositiveInt(partial.port) ?? defaults.port,
  }

  // database:仅在合法时写入,丢弃非法字段(避免 undefined 字段也成为 key)。
  const prismaSchema = typeof databaseRaw.prismaSchema === 'string' ? databaseRaw.prismaSchema : undefined
  const typeormDirs = asStringArray(databaseRaw.typeormDirs)
  if (prismaSchema !== undefined) config.database = { ...config.database, prismaSchema }
  if (typeormDirs !== undefined) config.database = { ...config.database, typeormDirs }

  // parser:仅当对象存在且至少有一个合法字段时才写入。
  if (parserRaw) {
    const maxTraceDepth = asPositiveInt(parserRaw.maxTraceDepth)
    const incremental = asBoolean(parserRaw.incremental)
    const parser: NonNullable<CodeOmniVisConfig['parser']> = {}
    if (maxTraceDepth !== undefined) parser.maxTraceDepth = maxTraceDepth
    if (incremental !== undefined) parser.incremental = incremental
    if (Object.keys(parser).length > 0) config.parser = parser
  }

  // ui:同理逐字段校验。
  if (uiRaw) {
    const theme = asEnum(uiRaw.theme, UI_THEMES)
    const layout = asEnum(uiRaw.layout, UI_LAYOUTS)
    const aggregateThreshold = asPositiveInt(uiRaw.aggregateThreshold)
    const ui: NonNullable<CodeOmniVisConfig['ui']> = {}
    if (theme !== undefined) ui.theme = theme
    if (layout !== undefined) ui.layout = layout
    if (aggregateThreshold !== undefined) ui.aggregateThreshold = aggregateThreshold
    if (Object.keys(ui).length > 0) config.ui = ui
  }

  return config
}
