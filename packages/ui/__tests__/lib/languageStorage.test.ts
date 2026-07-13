import { describe, expect, it, vi } from 'vitest'
import { persistLanguage, readStoredLanguage } from '../../src/lib/languageStorage'

describe('language storage', () => {
  it('accepts only supported stored languages', () => {
    expect(readStoredLanguage({ getItem: () => 'zh-CN' })).toBe('zh-CN')
    expect(readStoredLanguage({ getItem: () => 'fr-FR' })).toBe('en-US')
  })

  it('falls back when storage access throws', () => {
    expect(readStoredLanguage({ getItem: () => { throw new Error('blocked') } }))
      .toBe('en-US')
  })

  it('does not throw when persistence is unavailable', () => {
    const setItem = vi.fn(() => { throw new Error('quota') })

    expect(() => persistLanguage({ setItem }, 'zh-CN')).not.toThrow()
    expect(setItem).toHaveBeenCalled()
  })
})
