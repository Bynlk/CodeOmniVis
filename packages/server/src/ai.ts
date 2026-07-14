/**
 * AI 上游调用与 handler 装配。
 *
 * 配置来源优先级:请求体 config > 环境变量 > 未配置(501)。
 * 上游为用户自备的 OpenAI 兼容 endpoint(baseUrl/apiKey/model 全部来自用户配置),
 * 不连接任何内部网关。
 */

import type { Express, Request, RequestHandler, Response } from 'express'
import { promises as dns } from 'dns'
import {
  isJsonObject,
  parseAiChatRequest,
  resolveAiConfig,
  validateUpstreamBaseUrl,
  validateResolvedAddresses,
  isIpLiteral,
  type AiConfig,
  type AiEnvConfig,
  type ChatMessage,
  type UpstreamUrlCheck,
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
 * 可注入的 hostname 解析器:返回该主机解析到的 IP 地址列表。
 * 默认实现使用 Node 的 dns.lookup(all),便于测试时 mock,避免真实网络。
 */
export type HostnameResolver = (hostname: string) => Promise<string[]>

const defaultResolver: HostnameResolver = async (hostname) => {
  const records = await dns.lookup(hostname, { all: true })
  return records.map((r) => r.address)
}

/** 字面回环主机(localhost/127.x/::1)无需 DNS 解析即可放行。 */
function isLiteralLoopback(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '')
  if (h === 'localhost') return true
  if (h === '::1') return true
  return /^127\./.test(h)
}

/**
 * 解析上游 hostname 并校验解析结果(防 DNS rebinding)。
 * - 回环主机直接放行(本地模型服务场景);
 * - IP 字面量已由 validateUpstreamBaseUrl 校验过,无需再解析;
 * - 其余主机解析后校验,任一地址命中内网/链路本地/metadata/回环即拒绝。
 */
export async function checkUpstreamDnsSafety(
  baseUrl: string,
  resolver: HostnameResolver = defaultResolver,
): Promise<UpstreamUrlCheck> {
  let hostname: string
  try {
    hostname = new URL(baseUrl).hostname
  } catch {
    return { ok: false, reason: 'baseUrl is not a valid URL' }
  }
  if (isLiteralLoopback(hostname)) return { ok: true }
  if (isIpLiteral(hostname)) return { ok: true }
  let addresses: string[]
  try {
    addresses = await resolver(hostname)
  } catch (err) {
    return { ok: false, reason: `DNS resolution failed for ${hostname}: ${String(err)}` }
  }
  return validateResolvedAddresses(addresses)
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

/** 统一的 chat handler:解析契约 → 解析配置 → 字面校验 → DNS 解析校验 → 调上游 → 包 {data,meta}。 */
async function handleChat(req: Request, res: Response, resolver: HostnameResolver): Promise<void> {
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
  // 防 DNS rebinding:fetch 前解析 hostname,拒绝解析到内网/链路本地/metadata 的主机。
  const dnsCheck = await checkUpstreamDnsSafety(config.baseUrl, resolver)
  if (!dnsCheck.ok) {
    res.status(400).json({
      error: 'Invalid AI baseUrl',
      message: dnsCheck.reason ?? 'baseUrl rejected by DNS SSRF guard',
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

/**
 * 在 app 上注册 /api/ai/chat 与 /api/ai/explain(两者共用 chat 契约)。
 * resolver 可注入以便测试(默认使用 dns.lookup)。
 */
export function registerAiRoutes(
  app: Express,
  resolver: HostnameResolver = defaultResolver,
  accessGuard?: RequestHandler,
): void {
  const guard: RequestHandler = accessGuard ?? ((_req, _res, next) => next())
  app.post('/api/ai/chat', guard, (req, res) => { void handleChat(req, res, resolver) })
  app.post('/api/ai/explain', guard, (req, res) => { void handleChat(req, res, resolver) })
}
