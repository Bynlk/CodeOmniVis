/**
 * AI 请求/响应契约。
 *
 * 前端与 server 的 /api/ai/* handler 共用此契约。
 * 配置优先级:body.config > 环境变量 > 未配置(501)。配置存于前端 localStorage,不落库。
 */

import { isJsonObject } from './json'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/** 前端 localStorage 持有的 AI 连接配置(随请求体下发,不落库)。 */
export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AiChatRequest {
  messages: ChatMessage[]
  config?: AiConfig
}

export interface AiChatResponse {
  content: string
}

const CHAT_ROLES = new Set<string>(['system', 'user', 'assistant'])

export function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isJsonObject(value) &&
    typeof value.role === 'string' &&
    CHAT_ROLES.has(value.role) &&
    typeof value.content === 'string'
  )
}

export function isAiConfig(value: unknown): value is AiConfig {
  return (
    isJsonObject(value) &&
    typeof value.baseUrl === 'string' &&
    value.baseUrl.length > 0 &&
    typeof value.apiKey === 'string' &&
    value.apiKey.length > 0 &&
    typeof value.model === 'string' &&
    value.model.length > 0
  )
}

/** 解析聊天请求体(unknown → AiChatRequest | null),非法结构返回 null。 */
export function parseAiChatRequest(value: unknown): AiChatRequest | null {
  if (!isJsonObject(value)) return null
  const { messages, config } = value
  if (!Array.isArray(messages) || messages.length === 0) return null
  const parsed: ChatMessage[] = []
  for (const item of messages) {
    if (!isChatMessage(item)) return null
    parsed.push({ role: item.role, content: item.content })
  }
  if (config !== undefined && !isAiConfig(config)) return null
  return config === undefined ? { messages: parsed } : { messages: parsed, config }
}

/**
 * 校验用户提供的上游 baseUrl 是否可安全请求,防止 SSRF / open-proxy。
 *
 * 这是一个本机运行的开发工具,因此:
 * - 允许回环地址(localhost / 127.0.0.0/8 / ::1),以支持本地模型服务(如 Ollama),
 *   回环可走 http 或 https;
 * - 非回环主机必须使用 https;
 * - 始终拒绝内网 / 链路本地 / 云 metadata / 未指定地址,阻断对内部网络的探测:
 *   10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、169.254.0.0/16(含 169.254.169.254)、
 *   0.0.0.0、IPv6 ULA fc00::/7、IPv6 链路本地 fe80::/10。
 *
 * 纯函数,仅基于 URL 字面量判断(不做 DNS 解析);便于单测。
 */
export interface UpstreamUrlCheck {
  ok: boolean
  reason?: string
}

function isLoopbackHost(host: string): boolean {
  if (host === 'localhost') return true
  if (host === '::1' || host === '[::1]') return true
  return /^127\./.test(host)
}

/** 判断是否为应拒绝的内网 / 链路本地 / metadata / 未指定地址(字面量)。 */
function isBlockedHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '')
  if (h === '0.0.0.0' || h === '::') return true
  // IPv4 私网 / 链路本地
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  const m = /^172\.(\d{1,3})\./.exec(h)
  if (m) {
    const second = Number(m[1])
    if (second >= 16 && second <= 31) return true
  }
  // IPv6 ULA fc00::/7 (fc.. / fd..) 与链路本地 fe80::/10
  const lower = h.toLowerCase()
  if (/^f[cd][0-9a-f]*:/.test(lower)) return true
  if (/^fe[89ab][0-9a-f]*:/.test(lower)) return true
  return false
}

/** 判断 host 是否为 IP 字面量(IPv4/IPv6),无需 DNS 解析。 */
export function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
  if (h.includes(':')) return true
  return false
}

/**
 * 校验 DNS 解析得到的地址列表(防 DNS rebinding)。
 * 任一解析结果为回环/内网/链路本地/metadata,即拒绝。
 * 对于经字面量校验放行的回环主机(localhost/127.x/::1),调用方应跳过本检查。
 * 纯函数,便于单测。
 */
export function validateResolvedAddresses(addresses: string[]): UpstreamUrlCheck {
  if (addresses.length === 0) {
    return { ok: false, reason: 'Hostname did not resolve to any address' }
  }
  for (const addr of addresses) {
    if (isLoopbackHost(addr) || isBlockedHost(addr)) {
      return {
        ok: false,
        reason: `Hostname resolves to loopback/private/link-local/metadata address: ${addr}`,
      }
    }
  }
  return { ok: true }
}

export function validateUpstreamBaseUrl(baseUrl: string): UpstreamUrlCheck {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return { ok: false, reason: 'baseUrl is not a valid URL' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: `Unsupported protocol: ${url.protocol}` }
  }
  const host = url.hostname
  if (isBlockedHost(host)) {
    return { ok: false, reason: `Refusing to reach private/link-local/metadata address: ${host}` }
  }
  if (isLoopbackHost(host)) {
    return { ok: true }
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Non-loopback upstream must use https' }
  }
  return { ok: true }
}

/** server 端环境变量来源(可选)。 */
export interface AiEnvConfig {
  baseUrl?: string
  apiKey?: string
  model?: string
}

/**
 * 解析最终生效配置:body.config 优先,其次环境变量;两者都不全则返回 null(handler 应回 501)。
 * 纯函数,便于单测。
 */
export function resolveAiConfig(
  bodyConfig: AiConfig | undefined,
  env: AiEnvConfig,
): AiConfig | null {
  if (bodyConfig) return bodyConfig
  if (
    typeof env.baseUrl === 'string' &&
    env.baseUrl.length > 0 &&
    typeof env.apiKey === 'string' &&
    env.apiKey.length > 0 &&
    typeof env.model === 'string' &&
    env.model.length > 0
  ) {
    return { baseUrl: env.baseUrl, apiKey: env.apiKey, model: env.model }
  }
  return null
}
