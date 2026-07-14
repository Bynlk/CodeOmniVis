import { describe, expect, it } from 'vitest'
import {
  AiPolicyError,
  readBoundedBody,
  resolveUpstreamDestination,
} from '../../src/aiRequestPolicy'
import { RequestLimiter } from '../../src/requestLimiter'

async function* chunks(...values: string[]): AsyncGenerator<Uint8Array> {
  for (const value of values) yield Buffer.from(value)
}

describe('AI request destination policy', () => {
  it('pins a validated public DNS answer for the eventual connection', async () => {
    const destination = await resolveUpstreamDestination(
      'https://api.example.com/v1',
      async () => ['93.184.216.34'],
    )

    expect(destination.hostname).toBe('api.example.com')
    expect(destination.address).toBe('93.184.216.34')
    expect(destination.family).toBe(4)
  })

  it('rejects a public-looking host that resolves to a private address', async () => {
    await expect(resolveUpstreamDestination(
      'https://api.example.com/v1',
      async () => ['169.254.169.254'],
    )).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED', status: 400 })
  })

  it('rejects a response once its cumulative bytes exceed the limit', async () => {
    await expect(readBoundedBody(chunks('1234', '5678'), 7)).rejects.toMatchObject({
      code: 'AI_RESPONSE_TOO_LARGE',
      status: 502,
    })
  })

  it('exposes only a controlled public policy error', () => {
    const error = new AiPolicyError('AI_UPSTREAM_FAILED', 502, 'Upstream AI request failed')

    expect(error).toMatchObject({
      code: 'AI_UPSTREAM_FAILED',
      status: 502,
      message: 'Upstream AI request failed',
    })
  })
})

describe('RequestLimiter', () => {
  it('enforces concurrent requests per identity and releases capacity', () => {
    const limiter = new RequestLimiter({ maxConcurrent: 1, requestsPerWindow: 10, windowMs: 60_000 })
    const first = limiter.acquire('session-a', 1_000)
    const blocked = limiter.acquire('session-a', 1_001)

    expect(first.ok).toBe(true)
    expect(blocked).toEqual({ ok: false, reason: 'concurrency' })
    if (first.ok) first.release()
    expect(limiter.acquire('session-a', 1_002).ok).toBe(true)
  })

  it('enforces a fixed request window per identity', () => {
    const limiter = new RequestLimiter({ maxConcurrent: 2, requestsPerWindow: 2, windowMs: 1_000 })
    const first = limiter.acquire('session-a', 1_000)
    if (first.ok) first.release()
    const second = limiter.acquire('session-a', 1_001)
    if (second.ok) second.release()

    expect(limiter.acquire('session-a', 1_002)).toEqual({ ok: false, reason: 'rate' })
    expect(limiter.acquire('session-a', 2_001).ok).toBe(true)
  })
})
