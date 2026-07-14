import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { registerAiRoutes } from '../../src/ai'
import type { AiHttpClient, AiHttpResponse } from '../../src/aiRequestPolicy'

const CONFIG = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
}
const MESSAGES = [{ role: 'user' as const, content: 'hello' }]
const PUBLIC_RESOLVER = async (): Promise<string[]> => ['93.184.216.34']

async function* body(value: string): AsyncGenerator<Uint8Array> {
  yield Buffer.from(value)
}

function response(status: number, value: string): AiHttpResponse {
  return { status, body: body(value), close: async () => {} }
}

function makeApp(client: AiHttpClient, limits: Partial<{
  timeoutMs: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentPerIdentity: number
  requestsPerMinute: number
}> = {}) {
  const app = express()
  app.use(express.json())
  registerAiRoutes(app, PUBLIC_RESOLVER, undefined, { client, limits })
  return app
}

describe('AI route resource policy', () => {
  it('passes the validated DNS address to the HTTP client', async () => {
    let connectedAddress: string | undefined
    const client: AiHttpClient = async requestOptions => {
      connectedAddress = requestOptions.destination.address
      return response(200, '{"choices":[{"message":{"content":"ok"}}]}')
    }

    const result = await request(makeApp(client)).post('/api/ai/chat').send({
      messages: MESSAGES,
      config: CONFIG,
    })

    expect(result.status).toBe(200)
    expect(connectedAddress).toBe('93.184.216.34')
  })

  it('rejects a socket peer that differs from the validated DNS address', async () => {
    const client: AiHttpClient = async () => ({
      ...response(200, '{"choices":[{"message":{"content":"ok"}}]}'),
      peerAddress: '203.0.113.7',
    })

    const result = await request(makeApp(client))
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('AI_UPSTREAM_PEER_MISMATCH')
  })

  it('returns 504 when the upstream exceeds the total timeout', async () => {
    const client: AiHttpClient = requestOptions => new Promise((_resolve, reject) => {
      requestOptions.signal.addEventListener('abort', () => reject(requestOptions.signal.reason), {
        once: true,
      })
    })

    const result = await request(makeApp(client, { timeoutMs: 20 }))
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })

    expect(result.status).toBe(504)
    expect(result.body.error.code).toBe('AI_UPSTREAM_TIMEOUT')
  })

  it('returns 504 when the timeout occurs while streaming the response body', async () => {
    const client: AiHttpClient = async requestOptions => ({
      status: 200,
      body: (async function* waitForAbort(): AsyncGenerator<Uint8Array> {
        await new Promise<void>((_resolve, reject) => {
          requestOptions.signal.addEventListener(
            'abort',
            () => reject(requestOptions.signal.reason),
            { once: true },
          )
        })
      })(),
      close: async () => {},
    })

    const result = await request(makeApp(client, { timeoutMs: 20 }))
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })

    expect(result.status).toBe(504)
    expect(result.body.error.code).toBe('AI_UPSTREAM_TIMEOUT')
  })

  it('rejects redirects without following them', async () => {
    const client: AiHttpClient = async () => response(302, 'redirect')

    const result = await request(makeApp(client))
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('AI_UPSTREAM_REDIRECT')
  })

  it('rejects a response body above the configured byte limit', async () => {
    const client: AiHttpClient = async () => response(200, '123456789')

    const result = await request(makeApp(client, { maxResponseBytes: 8 }))
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('AI_RESPONSE_TOO_LARGE')
  })

  it('rejects an oversized request before opening an upstream connection', async () => {
    let called = false
    const client: AiHttpClient = async () => {
      called = true
      return response(200, '{"choices":[{"message":{"content":"ok"}}]}')
    }

    const result = await request(makeApp(client, { maxRequestBytes: 8 }))
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })

    expect(result.status).toBe(413)
    expect(result.body.error.code).toBe('AI_REQUEST_TOO_LARGE')
    expect(called).toBe(false)
  })

  it('rejects a second concurrent request from the same identity', async () => {
    let releaseFirst: (() => void) | undefined
    let markStarted: (() => void) | undefined
    const started = new Promise<void>(resolveStarted => { markStarted = resolveStarted })
    const client: AiHttpClient = async () => {
      markStarted?.()
      await new Promise<void>(resolveRelease => { releaseFirst = resolveRelease })
      return response(200, '{"choices":[{"message":{"content":"ok"}}]}')
    }
    const app = makeApp(client, { maxConcurrentPerIdentity: 1 })
    const first = request(app)
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })
      .then(result => result)
    await started

    const second = await request(app)
      .post('/api/ai/chat')
      .send({ messages: MESSAGES, config: CONFIG })
    releaseFirst?.()
    await first

    expect(second.status).toBe(429)
    expect(second.body.error.code).toBe('AI_CONCURRENCY_LIMIT')
  })
})
