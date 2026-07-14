import { createHash } from 'node:crypto'
import { promises as dns } from 'node:dns'
import type { Express, Request, RequestHandler, Response } from 'express'
import {
  isJsonObject,
  parseAiChatRequest,
  resolveAiConfig,
  type AiConfig,
  type AiEnvConfig,
  type ChatMessage,
  type UpstreamUrlCheck,
} from '@codeomnivis/shared'
import {
  AiPolicyError,
  DEFAULT_AI_LIMITS,
  defaultAiHttpClient,
  matchesValidatedAddress,
  readBoundedBody,
  resolveUpstreamDestination,
  type AiHttpClient,
  type AiRequestLimits,
  type HostnameResolver,
} from './aiRequestPolicy'
import { RequestLimiter } from './requestLimiter'

export type { HostnameResolver } from './aiRequestPolicy'

const defaultResolver: HostnameResolver = async hostname => {
  const records = await dns.lookup(hostname, { all: true })
  return records.map(record => record.address)
}

export function readAiEnv(env: NodeJS.ProcessEnv): AiEnvConfig {
  return {
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
  }
}

function extractContent(payload: unknown): string | null {
  if (!isJsonObject(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return null
  }
  const first = payload.choices[0]
  if (!isJsonObject(first) || !isJsonObject(first.message)) return null
  return typeof first.message.content === 'string' ? first.message.content : null
}

export async function checkUpstreamDnsSafety(
  baseUrl: string,
  resolver: HostnameResolver = defaultResolver,
): Promise<UpstreamUrlCheck> {
  try {
    await resolveUpstreamDestination(baseUrl, resolver)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof AiPolicyError ? err.message : 'AI destination validation failed',
    }
  }
}

interface CallAiOptions {
  client?: AiHttpClient
  resolver?: HostnameResolver
  limits?: AiRequestLimits
  allowLoopback?: boolean
}

export async function callAiChat(
  config: AiConfig,
  messages: ChatMessage[],
  options: CallAiOptions = {},
): Promise<string> {
  const client = options.client ?? defaultAiHttpClient
  const resolver = options.resolver ?? defaultResolver
  const limits = options.limits ?? DEFAULT_AI_LIMITS
  const requestBody = JSON.stringify({ model: config.model, messages })
  if (Buffer.byteLength(requestBody, 'utf8') > limits.maxRequestBytes) {
    throw new AiPolicyError('AI_REQUEST_TOO_LARGE', 413, 'AI request body was too large')
  }

  const destination = await resolveUpstreamDestination(
    config.baseUrl,
    resolver,
    options.allowLoopback ?? true,
  )
  const signal = AbortSignal.timeout(limits.timeoutMs)
  let upstream
  try {
    upstream = await client({
      destination,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: requestBody,
      signal,
    })
  } catch (err) {
    if (signal.aborted) {
      throw new AiPolicyError('AI_UPSTREAM_TIMEOUT', 504, 'Upstream AI request timed out')
    }
    if (err instanceof AiPolicyError) throw err
    throw new AiPolicyError('AI_UPSTREAM_FAILED', 502, 'Upstream AI request failed')
  }

  try {
    if (
      destination.address
      && upstream.peerAddress
      && !matchesValidatedAddress(upstream.peerAddress, destination.address)
    ) {
      throw new AiPolicyError(
        'AI_UPSTREAM_PEER_MISMATCH',
        502,
        'Upstream AI peer address was rejected',
      )
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      throw new AiPolicyError('AI_UPSTREAM_REDIRECT', 502, 'Upstream AI redirect was rejected')
    }
    if (upstream.status < 200 || upstream.status >= 300) {
      throw new AiPolicyError('AI_UPSTREAM_FAILED', 502, 'Upstream AI request failed')
    }
    const responseText = await readBoundedBody(upstream.body, limits.maxResponseBytes)
    let payload: unknown
    try {
      payload = JSON.parse(responseText)
    } catch {
      throw new AiPolicyError('AI_RESPONSE_INVALID', 502, 'Upstream AI response was invalid')
    }
    const content = extractContent(payload)
    if (content === null) {
      throw new AiPolicyError('AI_RESPONSE_INVALID', 502, 'Upstream AI response was invalid')
    }
    return content
  } catch (err) {
    if (signal.aborted) {
      throw new AiPolicyError('AI_UPSTREAM_TIMEOUT', 504, 'Upstream AI request timed out')
    }
    throw err
  } finally {
    await upstream.close().catch(() => {})
  }
}

function requestIdentity(req: Request): string {
  const source = req.headers.authorization
    ?? req.headers.cookie
    ?? req.socket.remoteAddress
    ?? 'local'
  return createHash('sha256').update(source).digest('hex')
}

function sendError(res: Response, error: AiPolicyError): void {
  res.status(error.status).json({ error: { code: error.code, message: error.message } })
}

interface HandlerOptions {
  client: AiHttpClient
  limits: AiRequestLimits
  limiter: RequestLimiter
  allowLoopback: boolean
}

async function handleChat(
  req: Request,
  res: Response,
  resolver: HostnameResolver,
  options: HandlerOptions,
): Promise<void> {
  const body: unknown = req.body
  const parsed = parseAiChatRequest(body)
  if (parsed === null) {
    sendError(res, new AiPolicyError('AI_REQUEST_INVALID', 400, 'Invalid AI chat request body'))
    return
  }
  const config = resolveAiConfig(parsed.config, readAiEnv(process.env))
  if (config === null) {
    res.status(501).json({
      error: {
        code: 'AI_NOT_CONFIGURED',
        message: 'Connect an API key in settings to enable AI features',
      },
    })
    return
  }

  const acquired = options.limiter.acquire(requestIdentity(req))
  if (!acquired.ok) {
    const concurrency = acquired.reason === 'concurrency'
    sendError(res, new AiPolicyError(
      concurrency ? 'AI_CONCURRENCY_LIMIT' : 'AI_RATE_LIMIT',
      429,
      concurrency ? 'Too many concurrent AI requests' : 'AI request rate limit exceeded',
    ))
    return
  }

  try {
    const content = await callAiChat(config, parsed.messages, {
      client: options.client,
      resolver,
      limits: options.limits,
      allowLoopback: options.allowLoopback,
    })
    res.json({ data: { content }, meta: {} })
  } catch (err) {
    sendError(
      res,
      err instanceof AiPolicyError
        ? err
        : new AiPolicyError('AI_UPSTREAM_FAILED', 502, 'Upstream AI request failed'),
    )
  } finally {
    acquired.release()
  }
}

export interface AiRouteOptions {
  client?: AiHttpClient
  limits?: Partial<AiRequestLimits>
  allowLoopback?: boolean
}

export function registerAiRoutes(
  app: Express,
  resolver: HostnameResolver = defaultResolver,
  accessGuard?: RequestHandler,
  routeOptions: AiRouteOptions = {},
): void {
  const guard: RequestHandler = accessGuard ?? ((_req, _res, next) => next())
  const limits = { ...DEFAULT_AI_LIMITS, ...routeOptions.limits }
  const handlerOptions: HandlerOptions = {
    client: routeOptions.client ?? defaultAiHttpClient,
    limits,
    allowLoopback: routeOptions.allowLoopback ?? true,
    limiter: new RequestLimiter({
      maxConcurrent: limits.maxConcurrentPerIdentity,
      requestsPerWindow: limits.requestsPerMinute,
      windowMs: 60_000,
    }),
  }
  app.post('/api/ai/chat', guard, (req, res) => {
    void handleChat(req, res, resolver, handlerOptions)
  })
  app.post('/api/ai/explain', guard, (req, res) => {
    void handleChat(req, res, resolver, handlerOptions)
  })
}
