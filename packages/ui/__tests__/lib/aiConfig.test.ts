/**
 * aiConfig 纯函数测试(不依赖 localStorage)。
 */

import { describe, it, expect } from 'vitest'
import {
  parseAiConfig,
  parsePersisted,
  buildConfig,
  splitForStorage,
  type PersistedAiMeta,
} from '../../src/lib/aiConfig'

describe('parseAiConfig', () => {
  it('returns null for null input', () => {
    expect(parseAiConfig(null)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseAiConfig('{not json')).toBeNull()
  })

  it('returns null for JSON missing required fields', () => {
    expect(parseAiConfig(JSON.stringify({ baseUrl: 'x' }))).toBeNull()
  })

  it('parses a valid config object', () => {
    const raw = JSON.stringify({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx', model: 'gpt-4o-mini' })
    const parsed = parseAiConfig(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.model).toBe('gpt-4o-mini')
    expect(parsed?.baseUrl).toBe('https://api.openai.com/v1')
  })
})

describe('parsePersisted', () => {
  it('returns null for null / invalid JSON', () => {
    expect(parsePersisted(null)).toBeNull()
    expect(parsePersisted('{nope')).toBeNull()
  })

  it('returns null when types are wrong', () => {
    expect(parsePersisted(JSON.stringify({ baseUrl: 1, model: 'm', rememberKey: true }))).toBeNull()
    expect(parsePersisted(JSON.stringify({ baseUrl: 'b', model: 'm', rememberKey: 'yes' }))).toBeNull()
  })

  it('keeps apiKey only when rememberKey is true', () => {
    const remembered = parsePersisted(
      JSON.stringify({ baseUrl: 'b', model: 'm', rememberKey: true, apiKey: 'sk-1' }),
    )
    expect(remembered?.apiKey).toBe('sk-1')

    const notRemembered = parsePersisted(
      JSON.stringify({ baseUrl: 'b', model: 'm', rememberKey: false, apiKey: 'sk-1' }),
    )
    expect(notRemembered).not.toBeNull()
    expect(notRemembered?.apiKey).toBeUndefined()
  })
})

describe('buildConfig', () => {
  it('returns null for null meta', () => {
    expect(buildConfig(null, 'sk-x')).toBeNull()
  })

  it('uses meta.apiKey when rememberKey is true', () => {
    const meta: PersistedAiMeta = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', rememberKey: true, apiKey: 'sk-remembered' }
    const cfg = buildConfig(meta, 'sk-session')
    expect(cfg?.apiKey).toBe('sk-remembered')
  })

  it('uses session apiKey when rememberKey is false', () => {
    const meta: PersistedAiMeta = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', rememberKey: false }
    const cfg = buildConfig(meta, 'sk-session')
    expect(cfg?.apiKey).toBe('sk-session')
  })

  it('returns null when no apiKey available (incomplete config)', () => {
    const meta: PersistedAiMeta = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', rememberKey: false }
    expect(buildConfig(meta, null)).toBeNull()
  })
})

describe('splitForStorage', () => {
  const config = { baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-secret', model: 'gpt-4o-mini' }

  it('keeps apiKey in persisted meta and no session key when remembered', () => {
    const { persisted, sessionApiKey } = splitForStorage(config, true)
    expect(sessionApiKey).toBeNull()
    const meta = parsePersisted(persisted)
    expect(meta?.rememberKey).toBe(true)
    expect(meta?.apiKey).toBe('sk-secret')
  })

  it('omits apiKey from persisted meta and routes secret to session when not remembered', () => {
    const { persisted, sessionApiKey } = splitForStorage(config, false)
    expect(sessionApiKey).toBe('sk-secret')
    const meta = parsePersisted(persisted)
    expect(meta?.rememberKey).toBe(false)
    expect(meta?.apiKey).toBeUndefined()
    // round-trip rebuild using session secret
    expect(buildConfig(meta, sessionApiKey)?.apiKey).toBe('sk-secret')
  })
})
