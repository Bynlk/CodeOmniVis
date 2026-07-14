import { randomBytes } from 'node:crypto'

export interface SessionStoreOptions {
  ttlMs: number
  maxSessions: number
}

export interface SessionRecord {
  id: string
  expiresAt: number
}

export class SessionStore {
  readonly ttlMs: number
  private readonly maxSessions: number
  private readonly sessions = new Map<string, number>()
  private readonly cleanupTimer: NodeJS.Timeout

  constructor(options: SessionStoreOptions) {
    if (!Number.isFinite(options.ttlMs) || options.ttlMs <= 0) {
      throw new Error('Session ttlMs must be a positive finite number')
    }
    if (!Number.isInteger(options.maxSessions) || options.maxSessions <= 0) {
      throw new Error('Session maxSessions must be a positive integer')
    }
    this.ttlMs = options.ttlMs
    this.maxSessions = options.maxSessions
    this.cleanupTimer = setInterval(
      () => this.removeExpired(Date.now()),
      Math.min(this.ttlMs, 60_000),
    )
    this.cleanupTimer.unref()
  }

  create(now = Date.now()): SessionRecord {
    this.removeExpired(now)
    while (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value
      if (typeof oldest !== 'string') break
      this.sessions.delete(oldest)
    }
    const record = {
      id: randomBytes(32).toString('base64url'),
      expiresAt: now + this.ttlMs,
    }
    this.sessions.set(record.id, record.expiresAt)
    return record
  }

  validate(id: string, now = Date.now()): boolean {
    const expiresAt = this.sessions.get(id)
    if (expiresAt === undefined) return false
    if (expiresAt <= now) {
      this.sessions.delete(id)
      return false
    }
    return true
  }

  revoke(id: string): void {
    this.sessions.delete(id)
  }

  clear(): void {
    this.sessions.clear()
  }

  dispose(): void {
    clearInterval(this.cleanupTimer)
    this.clear()
  }

  private removeExpired(now: number): void {
    for (const [id, expiresAt] of this.sessions) {
      if (expiresAt <= now) this.sessions.delete(id)
    }
  }
}
