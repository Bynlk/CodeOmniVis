export interface RequestLimiterOptions {
  maxConcurrent: number
  requestsPerWindow: number
  windowMs: number
  maxIdentities?: number
}

export type AcquireResult =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'concurrency' | 'rate' }

interface IdentityState {
  windowStartedAt: number
  requests: number
  inFlight: number
}

export class RequestLimiter {
  private readonly states = new Map<string, IdentityState>()
  private readonly maxIdentities: number

  constructor(private readonly options: RequestLimiterOptions) {
    this.maxIdentities = options.maxIdentities ?? 1_000
  }

  acquire(identity: string, now = Date.now()): AcquireResult {
    let state = this.states.get(identity)
    if (!state) {
      while (this.states.size >= this.maxIdentities) {
        const oldest = this.states.keys().next().value
        if (typeof oldest !== 'string') break
        this.states.delete(oldest)
      }
      state = { windowStartedAt: now, requests: 0, inFlight: 0 }
      this.states.set(identity, state)
    }
    if (now - state.windowStartedAt >= this.options.windowMs) {
      state.windowStartedAt = now
      state.requests = 0
    }
    if (state.inFlight >= this.options.maxConcurrent) {
      return { ok: false, reason: 'concurrency' }
    }
    if (state.requests >= this.options.requestsPerWindow) {
      return { ok: false, reason: 'rate' }
    }

    state.requests += 1
    state.inFlight += 1
    let released = false
    return {
      ok: true,
      release: () => {
        if (released) return
        released = true
        state.inFlight = Math.max(0, state.inFlight - 1)
      },
    }
  }
}
