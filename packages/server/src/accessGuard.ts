import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { isJsonObject } from '@codeomnivis/shared'
import { SessionStore } from './sessionStore'

export const SESSION_COOKIE_NAME = 'codeomnivis_session'

export interface AccessPolicyOptions {
  host: string
  accessToken?: string
  sessions: SessionStore
  secureCookies: boolean
}

export interface AccessPolicy {
  loopback: boolean
  accessTokenDigest?: Buffer
  sessions: SessionStore
  secureCookies: boolean
}

export type AccessDecision =
  { ok: true } | { ok: false; status: 401 | 403; code: 'AUTH_NOT_CONFIGURED' | 'UNAUTHORIZED' }

export function isLoopbackHost(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, '').toLowerCase()
  return normalized === 'localhost' || normalized === '::1' || /^127\./u.test(normalized)
}

function digestToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

function tokenMatches(provided: string, expected: Buffer | undefined): boolean {
  if (!expected) return false
  return timingSafeEqual(digestToken(provided), expected)
}

function bearerToken(headers: IncomingHttpHeaders): string | undefined {
  const authorization = headers.authorization
  if (typeof authorization === 'string') {
    const match = /^Bearer\s+(.+)$/iu.exec(authorization.trim())
    if (match) return match[1].trim()
  }
  const legacy = headers['x-access-token']
  if (typeof legacy === 'string' && legacy.trim() !== '') return legacy.trim()
  return undefined
}

function sessionCookie(headers: IncomingHttpHeaders): string | undefined {
  const cookie = headers.cookie
  if (typeof cookie !== 'string') return undefined
  for (const segment of cookie.split(';')) {
    const separator = segment.indexOf('=')
    if (separator < 0) continue
    const name = segment.slice(0, separator).trim()
    if (name === SESSION_COOKIE_NAME) return segment.slice(separator + 1).trim()
  }
  return undefined
}

export function createAccessPolicy(options: AccessPolicyOptions): AccessPolicy {
  return {
    loopback: isLoopbackHost(options.host),
    accessTokenDigest: options.accessToken ? digestToken(options.accessToken) : undefined,
    sessions: options.sessions,
    secureCookies: options.secureCookies,
  }
}

export function authenticateHeaders(
  headers: IncomingHttpHeaders,
  policy: AccessPolicy,
): AccessDecision {
  if (policy.loopback) return { ok: true }
  if (!policy.accessTokenDigest) {
    return { ok: false, status: 403, code: 'AUTH_NOT_CONFIGURED' }
  }
  const providedToken = bearerToken(headers)
  if (providedToken && tokenMatches(providedToken, policy.accessTokenDigest)) {
    return { ok: true }
  }
  const sessionId = sessionCookie(headers)
  if (sessionId && policy.sessions.validate(sessionId)) return { ok: true }
  return { ok: false, status: 401, code: 'UNAUTHORIZED' }
}

function sendAccessError(res: Response, decision: Exclude<AccessDecision, { ok: true }>): void {
  const message =
    decision.code === 'AUTH_NOT_CONFIGURED'
      ? 'Remote access is disabled because no access token is configured'
      : 'A valid access token or session is required for this operation'
  res.status(decision.status).json({ error: { code: decision.code, message } })
}

export function createAccessGuard(policy: AccessPolicy): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const decision = authenticateHeaders(req.headers, policy)
    if (!decision.ok) {
      sendAccessError(res, decision)
      return
    }
    next()
  }
}

export function createSessionHandler(policy: AccessPolicy): RequestHandler {
  return (req: Request, res: Response): void => {
    if (!policy.accessTokenDigest) {
      sendAccessError(res, { ok: false, status: 403, code: 'AUTH_NOT_CONFIGURED' })
      return
    }
    const body: unknown = req.body
    const accessToken = isJsonObject(body) ? body.accessToken : undefined
    if (typeof accessToken !== 'string' || !tokenMatches(accessToken, policy.accessTokenDigest)) {
      sendAccessError(res, { ok: false, status: 401, code: 'UNAUTHORIZED' })
      return
    }

    const session = policy.sessions.create()
    const attributes = [
      `${SESSION_COOKIE_NAME}=${session.id}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${Math.floor(policy.sessions.ttlMs / 1_000)}`,
    ]
    if (policy.secureCookies) attributes.push('Secure')
    res.setHeader('Set-Cookie', attributes.join('; '))
    res.json({ data: { expiresAt: session.expiresAt }, meta: {} })
  }
}
