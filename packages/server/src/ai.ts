/**
 * AI 上游调用与 handler 装配。
 *
 * 配置来源优先级:请求体 config > 环境变量 > 未配置(501)。
 * 上游为用户自备的 OpenAI 兼容 endpoint(baseUrl/apiKey/model 全部来自用户配置),
 * 不连接任何内部网关。
 */

import type { Express, Request, Response } from 'express'
import {
  isJsonObject,
  parseAiChatRequest,
  resolveAiConfig,
  validateUpstreamBaseUrl,
  type AiConfig,
  type AiEnvConfig,
  type ChatMessage,
} from '@codeomnivis/shared'

/** 从 process.env 读取可选的 AI 兜底配置。 */
export function readAiEnv(env: NodeJS.ProcessEnv): AiEnvConfig {
  return {
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
  }
}

/** 拼接 OpenAI 兼容的 chat/completions endpoint。 */
function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return `${trimmed}/chat/completions`
}

/** 从上游响应(unknown)中提取首条 message.content。 */
function extractContent(payload: unknown): string | null {
  if (!isJsonObject(payload)) return null
  const { choices } = payload
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0]
  if (!isJsonObject(first)) return null
  const { message } = first
  if (!isJsonObject(message)) return null
  const { content } = message
  return typeof content === 'string' ? content : null
}

/**
 * 调用用户自备的 OpenAI 兼容上游,返回助手文本。
 * 失败抛出 Error,由 handler 统一转 5xx。
 */
export async function callAiChat(config: AiConfig, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(chatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, messages }),
  })
  if (!res.ok) {
    throw new Error(`Upstream AI responded ${res.status}`)
  }
  const payload: unknown = await res.json()
  const content = extractContent(payload)
  if (content === null) {
    throw new Error('Upstream AI returned an unrecognized response shape')
  }
  return content
}

/** 统一的 chat handler:解析契约 → 解析配置 → 调上游 → 包 {data,meta}。 */
async function handleChat(req: Request, res: Response): Promise<void> {
  const parsed = parseAiChatRequest(req.body)
  if (parsed === null) {
    res.status(400).json({ error: 'Invalid AI chat request body' })
    return
  }
  const config = resolveAiConfig(parsed.config, readAiEnv(process.env))
  if (config === null) {
    res.status(501).json({
      error: 'AI not configured',
      message: 'Connect your API key in settings to enable AI features',
    })
    return
  }
  const urlCheck = validateUpstreamBaseUrl(config.baseUrl)
  if (!urlCheck.ok) {
    res.status(400).json({
      error: 'Invalid AI baseUrl',
      message: urlCheck.reason ?? 'baseUrl rejected by SSRF guard',
    })
    return
  }
  try {
    const content = await callAiChat(config, parsed.messages)
    res.json({ data: { content }, meta: {} })
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
}

/** 在 app 上注册 /api/ai/chat 与 /api/ai/explain(两者共用 chat 契约)。 */
export function registerAiRoutes(app: Express): void {
  app.post('/api/ai/chat', (req, res) => { void handleChat(req, res) })
  app.post('/api/ai/explain', (req, res) => { void handleChat(req, res) })
}
