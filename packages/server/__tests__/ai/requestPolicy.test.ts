import { describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { once } from 'node:events'
import {
  AiPolicyError,
  defaultAiHttpClient,
  matchesValidatedAddress,
  readBoundedBody,
  resolveUpstreamDestination,
} from '../../src/aiRequestPolicy'
import { checkUpstreamDnsSafety, readAiEnv } from '../../src/ai'
import { RequestLimiter } from '../../src/requestLimiter'

async function* chunks(...values: string[]): AsyncGenerator<Uint8Array> {
  for (const value of values) yield Buffer.from(value)
}

describe('AI request destination policy', () => {
  it('pins a validated public DNS answer for the eventual connection', async () => {
    const destination = await resolveUpstreamDestination('https://api.example.com/v1', async () => [
      '93.184.216.34',
    ])

    expect(destination.hostname).toBe('api.example.com')
    expect(destination.address).toBe('93.184.216.34')
    expect(destination.family).toBe(4)
  })

  it('rejects a public-looking host that resolves to a private address', async () => {
    await expect(
      resolveUpstreamDestination('https://api.example.com/v1', async () => ['169.254.169.254']),
    ).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED', status: 400 })
  })

  it('handles literal loopback and IP destinations without DNS drift', async () => {
    await expect(
      resolveUpstreamDestination('http://127.0.0.1:4321/v1', async () => []),
    ).resolves.toMatchObject({ hostname: '127.0.0.1', address: '127.0.0.1', family: 4 })
    await expect(
      resolveUpstreamDestination('http://localhost:4321/v1', async () => []),
    ).resolves.toMatchObject({ hostname: 'localhost' })
    await expect(
      resolveUpstreamDestination('http://localhost:4321/v1', async () => [], false),
    ).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED' })
  })

  it('rejects IPv4-mapped loopback destinations when remote access disables loopback', async () => {
    await expect(
      resolveUpstreamDestination('https://[::ffff:127.0.0.1]/v1', async () => [], false),
    ).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED', status: 400 })
  })

  it('rejects invalid URLs, DNS failures, and invalid public DNS answers', async () => {
    await expect(
      resolveUpstreamDestination('file:///tmp/provider', async () => []),
    ).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED' })
    await expect(
      resolveUpstreamDestination('https://api.example.com', async () => {
        throw new Error('dns')
      }),
    ).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED' })
    await expect(
      resolveUpstreamDestination('https://api.example.com', async () => ['not-an-ip']),
    ).rejects.toMatchObject({ code: 'AI_DESTINATION_REJECTED' })
  })

  it('rejects a response once its cumulative bytes exceed the limit', async () => {
    await expect(readBoundedBody(chunks('1234', '5678'), 7)).rejects.toMatchObject({
      code: 'AI_RESPONSE_TOO_LARGE',
      status: 502,
    })
  })

  it('reads a bounded response and accepts IPv4-mapped peer addresses', async () => {
    await expect(readBoundedBody(chunks('hello', ' world'), 11)).resolves.toBe('hello world')
    expect(matchesValidatedAddress('93.184.216.34', '93.184.216.34')).toBe(true)
    expect(matchesValidatedAddress('::ffff:93.184.216.34', '93.184.216.34')).toBe(true)
    expect(matchesValidatedAddress('::ffff:93.184.216.34', '::ffff:5db8:d822')).toBe(true)
    expect(matchesValidatedAddress('0::ffff:5db8:d822', '::ffff:93.184.216.34')).toBe(true)
    expect(matchesValidatedAddress('127.0.0.1', '93.184.216.34')).toBe(false)
  })

  it('performs a bounded loopback request and closes its dispatcher', async () => {
    const server = createServer((request, response) => {
      request.resume()
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"ok":true}')
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address')
    const destination = await resolveUpstreamDestination(
      `http://127.0.0.1:${address.port}/v1`,
      async () => [],
    )

    try {
      const response = await defaultAiHttpClient({
        destination,
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(5_000),
      })
      expect(response.status).toBe(200)
      await expect(readBoundedBody(response.body, 100)).resolves.toBe('{"ok":true}')
      await response.close()
    } finally {
      server.close()
      await once(server, 'close')
    }
  })

  it('pins a public hostname to the validated socket address', async () => {
    const server = createServer((request, response) => {
      request.resume()
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"ok":true}')
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address')

    try {
      const response = await defaultAiHttpClient({
        destination: {
          url: new URL(`http://provider.example:${address.port}/v1`),
          hostname: 'provider.example',
          address: '127.0.0.1',
          family: 4,
        },
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(5_000),
      })
      expect(response.peerAddress).toBe('127.0.0.1')
      await response.close()
    } finally {
      server.close()
      await once(server, 'close')
    }
  })

  it('exposes controlled DNS checks and environment configuration', async () => {
    expect(
      readAiEnv({ AI_BASE_URL: 'https://api.example.com', AI_API_KEY: 'key', AI_MODEL: 'model' }),
    ).toEqual({ baseUrl: 'https://api.example.com', apiKey: 'key', model: 'model' })
    await expect(
      checkUpstreamDnsSafety('https://api.example.com', async () => ['93.184.216.34']),
    ).resolves.toEqual({ ok: true })
    await expect(
      checkUpstreamDnsSafety('https://api.example.com', async () => {
        throw new Error('dns')
      }),
    ).resolves.toEqual({ ok: false, reason: 'AI hostname could not be resolved' })
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
    const limiter = new RequestLimiter({
      maxConcurrent: 1,
      requestsPerWindow: 10,
      windowMs: 60_000,
    })
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
