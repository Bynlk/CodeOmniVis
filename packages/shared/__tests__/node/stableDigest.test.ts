import { describe, expect, it } from 'vitest'
import { canonicalJson, stableDigest } from '../../src/node/stableDigest'

describe('stableDigest', () => {
  it('produces the same digest for reordered object keys', () => {
    expect(stableDigest({ b: 2, a: 1 })).toBe(stableDigest({ a: 1, b: 2 }))
  })

  it('canonicalizes nested objects while preserving array order', () => {
    expect(canonicalJson({ z: { b: 2, a: 1 }, a: ['x', 'y'] })).toBe(
      '{"a":["x","y"],"z":{"a":1,"b":2}}',
    )
    expect(stableDigest(['x', 'y'])).not.toBe(stableDigest(['y', 'x']))
  })

  it('returns a lowercase SHA-256 digest', () => {
    expect(stableDigest({ value: 'CodeOmniVis' })).toMatch(/^[a-f0-9]{64}$/u)
  })
})
