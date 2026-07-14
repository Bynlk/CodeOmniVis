/**
 * 访问鉴权守卫(S-07)
 *
 * 旧的 mutating-only guard 保留给直接使用 createGraphRouter 的兼容调用者。
 * createOmniServer 使用 accessGuard.ts 的统一 REST/WebSocket/session 策略。
 *
 * loopback 绑定(localhost / 127.x / ::1)沿用本机信任模型,放行 mutating 请求。
 * 鉴权不依赖 CORS / X-Confirm —— 二者均可被非浏览器客户端伪造。
 */

import type { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { isLoopbackHost } from './accessGuard'

export { isLoopbackHost } from './accessGuard'

/** 常量时间比较两个 token,避免计时侧信道。长度不等直接返回 false。 */
function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** 从请求头提取访问 token(Authorization: Bearer 优先,其次 X-Access-Token)。 */
function extractToken(req: Request): string | undefined {
  const auth = req.headers['authorization']
  if (typeof auth === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (match) return match[1].trim()
  }
  const xToken = req.headers['x-access-token']
  if (typeof xToken === 'string' && xToken.trim() !== '') return xToken.trim()
  return undefined
}

export interface MutatingGuardConfig {
  /** 服务器绑定的 host。 */
  host: string
  /** 配置的访问 token(可选);非 loopback 必须配置。 */
  token?: string
}

/**
 * 创建 mutating endpoint 的鉴权中间件。
 * - loopback 绑定:放行。
 * - 非 loopback 且未配置 token:服务器配置缺陷,一律 403。
 * - 非 loopback 且配置了 token:校验请求 token,缺失/不匹配 401。
 */
export function createMutatingGuard(config: MutatingGuardConfig): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  const loopback = isLoopbackHost(config.host)
  const token = config.token
  return (req: Request, res: Response, next: NextFunction): void => {
    if (loopback) {
      next()
      return
    }
    if (token === undefined || token === '') {
      res.status(403).json({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Mutating endpoints are disabled: non-loopback binding requires an access token',
        },
      })
      return
    }
    const provided = extractToken(req)
    if (provided === undefined || !tokensMatch(provided, token)) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'A valid access token is required for this operation',
        },
      })
      return
    }
    next()
  }
}
