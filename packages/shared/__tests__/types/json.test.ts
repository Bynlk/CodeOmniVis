import { describe, expect, it } from 'vitest'
import { isJsonObject, jsonObjectOrEmpty } from '../../src/types/json'

describe('json guards', () => {
  it('accepts plain objects', () => {
    expect(isJsonObject({ ok: true })).toBe(true)
  })

  it('rejects arrays and null', () => {
    expect(isJsonObject([])).toBe(false)
    expect(isJsonObject(null)).toBe(false)
  })

  it('returns empty object for non-object input', () => {
    expect(jsonObjectOrEmpty('x')).toEqual({})
  })
})
