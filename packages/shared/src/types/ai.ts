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
