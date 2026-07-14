import { describe, expect, it } from 'vitest'
import {
  isChatMessage,
  isAiConfig,
  parseAiChatRequest,
  resolveAiConfig,
  validateUpstreamBaseUrl,
  validateResolvedAddresses,
  isIpLiteral,
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
    expect(
      parseAiChatRequest({ messages: [{ role: 'user', content: 'hi' }], config: { baseUrl: '' } }),
    ).toBeNull()
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

describe('validateUpstreamBaseUrl', () => {
  it('accepts public https endpoints', () => {
    expect(validateUpstreamBaseUrl('https://api.openai.com/v1').ok).toBe(true)
    expect(validateUpstreamBaseUrl('https://api.example.com:8443/v1').ok).toBe(true)
  })

  it('accepts loopback over http or https (local model servers)', () => {
    expect(validateUpstreamBaseUrl('http://localhost:11434/v1').ok).toBe(true)
    expect(validateUpstreamBaseUrl('http://127.0.0.1:1234/v1').ok).toBe(true)
    expect(validateUpstreamBaseUrl('http://[::1]:8000/v1').ok).toBe(true)
  })

  it('rejects non-loopback http', () => {
    expect(validateUpstreamBaseUrl('http://api.example.com/v1').ok).toBe(false)
  })

  it('rejects private / link-local / metadata addresses', () => {
    expect(validateUpstreamBaseUrl('https://10.0.0.5/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://172.16.0.1/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://172.31.255.1/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://192.168.1.1/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://169.254.169.254/latest/meta-data').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://0.0.0.0/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://[fd00::1]/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://[fe80::1]/v1').ok).toBe(false)
  })

  it('rejects IPv4-mapped IPv6 private destinations while preserving public endpoints', () => {
    expect(validateUpstreamBaseUrl('https://[::ffff:127.0.0.1]/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://[::ffff:a00:1]/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://[::ffff:a9fe:a9fe]/v1').ok).toBe(false)
    expect(validateUpstreamBaseUrl('https://[::ffff:5db8:d822]/v1').ok).toBe(true)
  })

  it('does NOT block public 172 addresses outside 16-31', () => {
    expect(validateUpstreamBaseUrl('https://172.15.0.1/v1').ok).toBe(true)
    expect(validateUpstreamBaseUrl('https://172.32.0.1/v1').ok).toBe(true)
  })

  it('rejects malformed or unsupported-protocol urls', () => {
    expect(validateUpstreamBaseUrl('not a url').ok).toBe(false)
    expect(validateUpstreamBaseUrl('ftp://example.com').ok).toBe(false)
    expect(validateUpstreamBaseUrl('file:///etc/passwd').ok).toBe(false)
  })
})

describe('validateResolvedAddresses (S-06/F5 DNS rebinding)', () => {
  it('accepts only-public resolved addresses', () => {
    expect(validateResolvedAddresses(['93.184.216.34']).ok).toBe(true)
  })

  it('rejects when any resolved address is private/link-local/metadata/loopback', () => {
    expect(validateResolvedAddresses(['169.254.169.254']).ok).toBe(false)
    expect(validateResolvedAddresses(['10.0.0.1']).ok).toBe(false)
    expect(validateResolvedAddresses(['127.0.0.1']).ok).toBe(false)
    expect(validateResolvedAddresses(['::1']).ok).toBe(false)
    // 混合:一个公网 + 一个内网 -> 仍拒绝
    expect(validateResolvedAddresses(['93.184.216.34', '192.168.1.1']).ok).toBe(false)
  })

  it('rejects mapped private DNS answers while preserving mapped public answers', () => {
    expect(validateResolvedAddresses(['::ffff:127.0.0.1']).ok).toBe(false)
    expect(validateResolvedAddresses(['::ffff:10.0.0.1']).ok).toBe(false)
    expect(validateResolvedAddresses(['::ffff:169.254.169.254']).ok).toBe(false)
    expect(validateResolvedAddresses(['::ffff:93.184.216.34']).ok).toBe(true)
  })

  it('rejects partially compressed mapped private DNS answers', () => {
    expect(validateResolvedAddresses(['0::ffff:7f00:1']).ok).toBe(false)
    expect(validateResolvedAddresses(['0:0::ffff:10.0.0.1']).ok).toBe(false)
    expect(validateResolvedAddresses(['0:0:0::ffff:ac10:1']).ok).toBe(false)
    expect(validateResolvedAddresses(['0:0:0:0::ffff:c0a8:101']).ok).toBe(false)
    expect(validateResolvedAddresses(['0::ffff:169.254.169.254']).ok).toBe(false)
    expect(validateResolvedAddresses(['0:0::ffff:5db8:d822']).ok).toBe(true)
  })

  it('rejects expanded native IPv6 loopback answers', () => {
    expect(validateResolvedAddresses(['0:0:0:0:0:0:0:1']).ok).toBe(false)
  })

  it('rejects expanded native IPv6 unspecified answers', () => {
    expect(validateResolvedAddresses(['0:0:0:0:0:0:0:0']).ok).toBe(false)
  })

  it('rejects empty resolution result', () => {
    expect(validateResolvedAddresses([]).ok).toBe(false)
  })
})

describe('isIpLiteral', () => {
  it('detects IPv4/IPv6 literals', () => {
    expect(isIpLiteral('127.0.0.1')).toBe(true)
    expect(isIpLiteral('93.184.216.34')).toBe(true)
    expect(isIpLiteral('::1')).toBe(true)
    expect(isIpLiteral('fe80::1')).toBe(true)
  })

  it('returns false for hostnames', () => {
    expect(isIpLiteral('api.example.com')).toBe(false)
    expect(isIpLiteral('localhost')).toBe(false)
  })
})
