/**
 * 推广位 + License 信息测试。
 */

import { describe, it, expect } from 'vitest'
import { PROMOTION_TIERS, LICENSE_INFO } from '../../src/lib/promotion'
import type { PromotionTier } from '../../src/lib/promotion'

describe('PROMOTION_TIERS', () => {
  it('contains exactly three tiers', () => {
    expect(PROMOTION_TIERS).toHaveLength(3)
  })

  it('covers primary/secondary/tertiary in order', () => {
    const tiers: PromotionTier[] = PROMOTION_TIERS.map(s => s.tier)
    expect(tiers).toEqual<PromotionTier[]>(['primary', 'secondary', 'tertiary'])
  })

  it('every slot has i18n keys and a https url', () => {
    for (const slot of PROMOTION_TIERS) {
      expect(slot.titleKey.length).toBeGreaterThan(0)
      expect(slot.descKey.length).toBeGreaterThan(0)
      expect(slot.ctaKey.length).toBeGreaterThan(0)
      expect(slot.url.startsWith('https://')).toBe(true)
    }
  })
})

describe('LICENSE_INFO', () => {
  it('is PolyForm Noncommercial', () => {
    expect(LICENSE_INFO.noncommercial).toBe(true)
    expect(LICENSE_INFO.spdxId).toBe('LicenseRef-PolyForm-Noncommercial-1.0.0')
    expect(LICENSE_INFO.url).toContain('polyformproject.org')
  })
})
