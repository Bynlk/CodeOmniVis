/**
 * 配置文件加载器
 *
 * 加载 .codeomnivis.json 配置文件，与默认值合并。
 * 遵循"降级而非崩溃"原则：配置文件不存在或解析失败时使用默认值。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CodeOmniVisConfig } from '../types/config'

const CONFIG_FILENAME = '.codeomnivis.json'

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
    const parsed = JSON.parse(raw) as Partial<CodeOmniVisConfig>
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
 * 将用户配置与默认值合并
 */
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
