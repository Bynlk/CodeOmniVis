import { describe, expect, it } from 'vitest'
import {
  isChatMessage,
  isAiConfig,
  parseAiChatRequest,
  resolveAiConfig,
} from '../../src/types/ai'

describe('isChatMessage', () => {
  it('accepts valid messages', () => {
    expect(isChatMessage({ role: 'user', content: 'hi' })).toBe(true)
    expect(isChatMessage({ role: 'system', content: '' })).toBe(true)
    expect(isChatMessage({ role: 'assistant', content: 'ok' })).toBe(true)
  })

  it('rejects invalid role or shape', () => {
    expect(isChatMessage({ role: 'tool', content: 'x' })).toBe(false)
    expect(isChatMessage({ role: 'user' })).toBe(false)
    expect(isChatMessage({ content: 'x' })).toBe(false)
    expect(isChatMessage('user')).toBe(false)
    expect(isChatMessage(null)).toBe(false)
  })
})

describe('isAiConfig', () => {
  it('accepts a fully-populated config', () => {
    expect(isAiConfig({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })).toBe(true)
  })

  it('rejects partial or empty fields', () => {
    expect(isAiConfig({ baseUrl: '', apiKey: 'k', model: 'm' })).toBe(false)
    expect(isAiConfig({ baseUrl: 'https://x', apiKey: 'k' })).toBe(false)
    expect(isAiConfig(undefined)).toBe(false)
  })
})

describe('parseAiChatRequest', () => {
  it('parses a request with messages only', () => {
    const r = parseAiChatRequest({ messages: [{ role: 'user', content: 'hi' }] })
    expect(r).toEqual({ messages: [{ role: 'user', content: 'hi' }] })
  })

  it('parses a request with config', () => {
    const r = parseAiChatRequest({
      messages: [{ role: 'user', content: 'hi' }],
      config: { baseUrl: 'https://x', apiKey: 'k', model: 'm' },
    })
    expect(r?.config?.model).toBe('m')
  })

  it('rejects empty / invalid bodies', () => {
    expect(parseAiChatRequest({ messages: [] })).toBeNull()
    expect(parseAiChatRequest({ messages: [{ role: 'x', content: 'y' }] })).toBeNull()
    expect(parseAiChatRequest({ messages: [{ role: 'user', content: 'hi' }], config: { baseUrl: '' } })).toBeNull()
    expect(parseAiChatRequest(null)).toBeNull()
  })
})

describe('resolveAiConfig', () => {
  it('prefers body config over env', () => {
    const body = { baseUrl: 'https://body', apiKey: 'bk', model: 'bm' }
    const env = { baseUrl: 'https://env', apiKey: 'ek', model: 'em' }
    expect(resolveAiConfig(body, env)).toEqual(body)
  })

  it('falls back to a complete env config', () => {
    const env = { baseUrl: 'https://env', apiKey: 'ek', model: 'em' }
    expect(resolveAiConfig(undefined, env)).toEqual(env)
  })

  it('returns null when neither body nor a complete env exists', () => {
    expect(resolveAiConfig(undefined, {})).toBeNull()
    expect(resolveAiConfig(undefined, { baseUrl: 'https://env', apiKey: 'ek' })).toBeNull()
  })
})
