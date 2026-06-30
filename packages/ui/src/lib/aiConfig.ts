/**
 * AI 配置的单一数据源(reactive store)+ 密钥分级存储。
 *
 * 设计目标(评审 M3 / M4):
 *  - M3:SettingsDrawer 与 AiPanel 共用同一份配置状态,任一处保存/清除会
 *    立即反映到另一处。通过外部 store + useSyncExternalStore 订阅实现,
 *    不再各自 useState 复制一份导致漂移。
 *  - M4:apiKey 默认只放 sessionStorage(关闭标签即失效),仅当用户显式勾选
 *    "记住密钥"时才落 localStorage。baseUrl/model/记住标记属非敏感项,常驻
 *    localStorage。
 *
 * 纯函数(parsePersisted / buildConfig / parseAiConfig)不触碰 storage,便于单测。
 */

import { isAiConfig, isJsonObject, type AiConfig } from '@codeomnivis/shared'

/** localStorage:非敏感配置 + (仅在记住时)apiKey。 */
export const AI_CONFIG_STORAGE_KEY = 'codeomnivis.ai.config'
/** sessionStorage:未记住时的 apiKey(随标签页生命周期)。 */
export const AI_SESSION_KEY = 'codeomnivis.ai.apiKey'

/** 持久化到 localStorage 的非敏感元信息;apiKey 仅在 rememberKey 时存在。 */
export interface PersistedAiMeta {
  baseUrl: string
  model: string
  rememberKey: boolean
  apiKey?: string
}

/** 当前完整配置 + 是否记住密钥(供 UI 还原勾选态)。 */
export interface AiConfigState {
  config: AiConfig | null
  rememberKey: boolean
}

/**
 * 纯解析:把可能为 null 的 JSON 字符串收敛为完整 AiConfig | null。
 * 仅用于向后兼容旧版整对象格式与单元测试。
 */
export function parseAiConfig(raw: string | null): AiConfig | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isAiConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 纯解析:localStorage 中的非敏感元信息。 */
export function parsePersisted(raw: string | null): PersistedAiMeta | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isJsonObject(parsed)) return null
  const { baseUrl, model, rememberKey, apiKey } = parsed
  if (typeof baseUrl !== 'string' || typeof model !== 'string' || typeof rememberKey !== 'boolean') {
    return null
  }
  const meta: PersistedAiMeta = { baseUrl, model, rememberKey }
  if (rememberKey && typeof apiKey === 'string') meta.apiKey = apiKey
  return meta
}

/**
 * 纯组合:由(非敏感元信息 + 会话内 apiKey)还原完整配置。
 * rememberKey 为真时用 meta.apiKey;否则用 sessionApiKey。三项齐全且合法才返回。
 */
export function buildConfig(meta: PersistedAiMeta | null, sessionApiKey: string | null): AiConfig | null {
  if (meta === null) return null
  const apiKey = meta.rememberKey ? meta.apiKey ?? '' : sessionApiKey ?? ''
  const candidate = { baseUrl: meta.baseUrl, apiKey, model: meta.model }
  return isAiConfig(candidate) ? candidate : null
}

/** 纯拆分:把完整配置按 rememberKey 拆成 localStorage 串与会话内 apiKey。 */
export function splitForStorage(
  config: AiConfig,
  rememberKey: boolean,
): { persisted: string; sessionApiKey: string | null } {
  const meta: PersistedAiMeta = rememberKey
    ? { baseUrl: config.baseUrl, model: config.model, rememberKey: true, apiKey: config.apiKey }
    : { baseUrl: config.baseUrl, model: config.model, rememberKey: false }
  return {
    persisted: JSON.stringify(meta),
    sessionApiKey: rememberKey ? null : config.apiKey,
  }
}

// ============================================================
// Reactive store(单一数据源)
// ============================================================

type Listener = () => void
const listeners = new Set<Listener>()

/** 从存储重新计算当前状态(node 环境无 storage 时安全返回空)。 */
function computeState(): AiConfigState {
  try {
    const meta = parsePersisted(localStorage.getItem(AI_CONFIG_STORAGE_KEY))
    const sessionApiKey = sessionStorage.getItem(AI_SESSION_KEY)
    return {
      config: buildConfig(meta, sessionApiKey),
      rememberKey: meta?.rememberKey ?? false,
    }
  } catch {
    return { config: null, rememberKey: false }
  }
}

// 缓存快照:useSyncExternalStore 要求 getSnapshot 返回稳定引用,仅在变更时刷新。
let snapshot: AiConfigState = computeState()

function refreshSnapshot(): void {
  snapshot = computeState()
  for (const listener of listeners) listener()
}

/** 订阅配置变更(返回退订函数)。同源跨标签通过 storage 事件感知。 */
export function subscribeAiConfig(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 当前配置状态快照(稳定引用)。 */
export function getAiConfigState(): AiConfigState {
  return snapshot
}

/** 便捷读取:当前配置(无则 null)。 */
export function loadAiConfig(): AiConfig | null {
  return snapshot.config
}

/** 保存配置:rememberKey 决定 apiKey 落 localStorage 还是仅 sessionStorage。 */
export function setAiConfig(config: AiConfig, rememberKey: boolean): void {
  try {
    const { persisted, sessionApiKey } = splitForStorage(config, rememberKey)
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, persisted)
    if (sessionApiKey === null) {
      sessionStorage.removeItem(AI_SESSION_KEY)
    } else {
      sessionStorage.setItem(AI_SESSION_KEY, sessionApiKey)
    }
  } catch {
    // storage 不可用(隐私模式/SSR):仅更新内存快照。
  }
  refreshSnapshot()
}

/** 清除配置(localStorage 与 sessionStorage 同时清)。 */
export function clearAiConfig(): void {
  try {
    localStorage.removeItem(AI_CONFIG_STORAGE_KEY)
    sessionStorage.removeItem(AI_SESSION_KEY)
  } catch {
    // 忽略
  }
  refreshSnapshot()
}

// 同源其它标签页修改时同步刷新。
try {
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === AI_CONFIG_STORAGE_KEY || e.key === AI_SESSION_KEY || e.key === null) {
        refreshSnapshot()
      }
    })
  }
} catch {
  // 非浏览器环境忽略
}
