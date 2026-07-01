import { describe, it, expect } from 'vitest'
import { unwrapData } from '../../src/utils/unwrapData'

describe('unwrapData', () => {
  it('extracts data from object with data key', () => {
    expect(unwrapData({ data: 'hello' })).toBe('hello')
  })

  it('extracts data from nested object', () => {
    expect(unwrapData({ data: { items: [1, 2, 3] } })).toEqual({ items: [1, 2, 3] })
  })

  it('returns undefined for null', () => {
    expect(unwrapData(null)).toBeUndefined()
  })

  it('returns undefined for primitive', () => {
    expect(unwrapData('string')).toBeUndefined()
    expect(unwrapData(42)).toBeUndefined()
    expect(unwrapData(true)).toBeUndefined()
  })

  it('returns undefined for array (isJsonObject rejects arrays)', () => {
    // This is the key behavioral difference from typeof==='object' version
    expect(unwrapData([{ data: 'nested' }])).toBeUndefined()
  })

  it('returns undefined for object without data key', () => {
    expect(unwrapData({ error: 'not found' })).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(unwrapData(undefined)).toBeUndefined()
  })

  it('handles falsy data values correctly', () => {
    expect(unwrapData({ data: 0 })).toBe(0)
    expect(unwrapData({ data: '' })).toBe('')
    expect(unwrapData({ data: false })).toBe(false)
    expect(unwrapData({ data: null })).toBeNull()
  })
})
