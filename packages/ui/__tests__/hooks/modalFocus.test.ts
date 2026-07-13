import { describe, expect, it } from 'vitest'
import { getNextFocusIndex } from '../../src/hooks/useModalFocusTrap'

describe('getNextFocusIndex', () => {
  it('enters the trap from the first or last element based on direction', () => {
    expect(getNextFocusIndex(-1, 4, false)).toBe(0)
    expect(getNextFocusIndex(-1, 4, true)).toBe(3)
  })

  it('wraps focus at both ends', () => {
    expect(getNextFocusIndex(3, 4, false)).toBe(0)
    expect(getNextFocusIndex(0, 4, true)).toBe(3)
  })

  it('keeps an empty trap inactive', () => {
    expect(getNextFocusIndex(-1, 0, false)).toBe(-1)
  })
})
