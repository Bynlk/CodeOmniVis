/**
 * AI 路由测试:契约 + 配置优先级 + 上游响应解析。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { registerAiRoutes } from '../../src/ai'

// 默认 mock resolver:把测试主机解析为一个公网 IP,避免真实 DNS 查询。
const PUBLIC_RESOLVER = async (_hostname: string): Promise<string[]> => ['93.184.216.34']

function makeApp(resolver: (hostname: string) => Promise<string[]> = PUBLIC_RESOLVER) {
  const app = express()
  app.use(express.json())
  registerAiRoutes(app, resolver)
  return app
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    delete process.env.AI_BASE_URL
    delete process.env.AI_API_KEY
    delete process.env.AI_MODEL
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 for an invalid body', async () => {
    const res = await request(makeApp()).post('/api/ai/chat').send({ messages: [] })
    expect(res.status).toBe(400)
  })

  it('returns 501 when no config in body or env', async () => {
    const res = await request(makeApp())
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] })
    expect(res.status).toBe(501)
    expect(res.body.error).toBe('AI not configured')
  })

  it('returns the AiChatResponse contract when config is provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: 'assistant', content: 'hello world' } }] }),
    )

    const res = await request(makeApp())
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        config: { baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm' },
      })

    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('hello world')
  })

  it('uses env config as fallback', async () => {
    process.env.AI_BASE_URL = 'https://env.example.com/v1'
    process.env.AI_API_KEY = 'ek'
    process.env.AI_MODEL = 'em'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: 'assistant', content: 'from env' } }] }),
    )

    const res = await request(makeApp())
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] })

    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('from env')
  })

  it('returns 502 when the upstream fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }))

    const res = await request(makeApp())
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        config: { baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm' },
      })

    expect(res.status).toBe(502)
  })

  it('returns 400 and never fetches for a blocked private baseUrl (SSRF guard)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const res = await request(makeApp())
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        config: { baseUrl: 'https://169.254.169.254/latest', apiKey: 'k', model: 'm' },
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid AI baseUrl')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 400 for non-loopback http baseUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const res = await request(makeApp())
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        config: { baseUrl: 'http://api.example.com/v1', apiKey: 'k', model: 'm' },
      })

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 400 and never fetches when hostname resolves to a private address (DNS rebinding)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // 公网外观主机名,但解析到内网地址 -> 必须拦截
    const rebindResolver = async (_hostname: string): Promise<string[]> => ['169.254.169.254']

    const res = await request(makeApp(rebindResolver))
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        config: { baseUrl: 'https://evil-but-public-looking.example.com/v1', apiKey: 'k', model: 'm' },
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid AI baseUrl')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when hostname resolves to a loopback address (rebinding to localhost)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const rebindResolver = async (_hostname: string): Promise<string[]> => ['127.0.0.1']

    const res = await request(makeApp(rebindResolver))
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        config: { baseUrl: 'https://looks-public.example.com/v1', apiKey: 'k', model: 'm' },
      })

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('POST /api/ai/explain', () => {
  it('shares the chat contract', async () => {
    const res = await request(makeApp())
      .post('/api/ai/explain')
      .send({ messages: [{ role: 'user', content: 'explain' }] })
    expect(res.status).toBe(501)
  })
})
