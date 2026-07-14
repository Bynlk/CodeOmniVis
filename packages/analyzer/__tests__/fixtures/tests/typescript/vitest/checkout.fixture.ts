import { beforeEach, describe, expect, it, test } from 'vitest'

describe('checkout', () => {
  beforeEach(() => {})

  describe('cards', () => {
    it.skip('rejects expired card', () => {
      expect(true).toBe(true)
    })

    test.each([['visa'], ['mastercard']])('accepts %s', () => {})
  })
})
