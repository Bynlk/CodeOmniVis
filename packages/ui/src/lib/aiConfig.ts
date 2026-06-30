/**
 * AI 配置的 localStorage 读写助手。
 *
 * 之前 AiPanel / TracePanel 各自重复实现,这里收敛为单一来源。
 * parseAiConfig 为纯函数(不触碰 localStorage),便于单测。
 */

import { isAiConfig, type AiConfig } from '@codeomnivis/shared'

export const AI_CONFIG_STORAGE_KEY = 'codeomnivis.ai.config'

/** 纯解析:把可能为 null 的 JSON 字符串收敛为 AiConfig | null。 */
export function parseAiConfig(raw: string | null): AiConfig | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isAiConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 从 localStorage 读取 AI 配置(非法/缺失返回 null)。 */
export function loadAiConfig(): AiConfig | null {
  try {
    return parseAiConfig(localStorage.getItem(AI_CONFIG_STORAGE_KEY))
  } catch {
    return null
  }
}

/** 写入 AI 配置。 */
export function saveAiConfig(config: AiConfig): void {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config))
}

/** 清除 AI 配置。 */
export function clearAiConfig(): void {
  localStorage.removeItem(AI_CONFIG_STORAGE_KEY)
}
