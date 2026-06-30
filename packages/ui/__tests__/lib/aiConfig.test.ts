/**
 * parseAiConfig 纯函数测试(不依赖 localStorage)。
 */

import { describe, it, expect } from 'vitest'
import { parseAiConfig } from '../../src/lib/aiConfig'

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
