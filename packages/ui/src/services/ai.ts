/**
 * AI 领域服务（feature-001-service-layer）。
 * 封装 POST /api/ai/chat 与 POST /api/ai/explain。
 */

import { isJsonObject } from '@codeomnivis/shared'
import { jsonPost, ApiError } from './client'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiRequestBody {
  messages: ChatMessage[]
  config?: unknown
}

/** AI 调用结果：content 为空串表示无有效回复；status 用于上层区分 429 等；errorMessage 为后端错误详情。 */
export interface AiResult {
  ok: boolean
  content?: string
  status: number
  errorMessage?: string
}

function readStr(obj: unknown, key: string): string | undefined {
  return isJsonObject(obj) && typeof obj[key] === 'string' ? obj[key] : undefined
}

async function postAi(url: string, body: AiRequestBody, signal?: AbortSignal): Promise<AiResult> {
  const res = await fetch(url, jsonPost(body, signal))
  if (res.ok) {
    const payload: unknown = await res.json().catch(() => undefined)
    const data = isJsonObject(payload) ? payload.data : undefined
    const content = isJsonObject(data) && typeof data.content === 'string' ? data.content : undefined
    return { ok: true, content, status: res.status }
  }
  // 失败：尽量解析后端返回的错误详情
  const errData: unknown = await res.json().catch(() => undefined)
  const errorMessage = readStr(errData, 'message') ?? readStr(errData, 'error')
  return { ok: false, status: res.status, errorMessage }
}

export function postAiChat(body: AiRequestBody, signal?: AbortSignal): Promise<AiResult> {
  return postAi('/api/ai/chat', body, signal)
}

export function postAiExplain(body: AiRequestBody, signal?: AbortSignal): Promise<AiResult> {
  return postAi('/api/ai/explain', body, signal)
}

export { ApiError }
