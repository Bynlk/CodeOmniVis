/**
 * 三层推广位 + 非商业 License 信息。
 *
 * 推广位按权重分三层(primary / secondary / tertiary),设置抽屉「关于」组渲染。
 * License 采用 PolyForm Noncommercial 1.0.0,与 package.json 的 license 字段一致。
 */

export type PromotionTier = 'primary' | 'secondary' | 'tertiary'

export interface PromotionSlot {
  readonly tier: PromotionTier
  /** i18n key:标题 */
  readonly titleKey: string
  /** i18n key:描述 */
  readonly descKey: string
  /** i18n key:行动按钮文案 */
  readonly ctaKey: string
  /** 跳转链接 */
  readonly url: string
}

export const PROMOTION_TIERS: readonly PromotionSlot[] = [
  {
    tier: 'primary',
    titleKey: 'promo.primary.title',
    descKey: 'promo.primary.desc',
    ctaKey: 'promo.primary.cta',
    url: 'https://github.com/Bynlk/CodeOmniVis',
  },
  {
    tier: 'secondary',
    titleKey: 'promo.secondary.title',
    descKey: 'promo.secondary.desc',
    ctaKey: 'promo.secondary.cta',
    url: 'https://github.com/Bynlk/CodeOmniVis/issues',
  },
  {
    tier: 'tertiary',
    titleKey: 'promo.tertiary.title',
    descKey: 'promo.tertiary.desc',
    ctaKey: 'promo.tertiary.cta',
    url: 'https://github.com/Bynlk/CodeOmniVis/blob/master/README.md',
  },
]

export interface LicenseInfo {
  readonly name: string
  readonly spdxId: string
  readonly url: string
  readonly noncommercial: boolean
  /** i18n key:授权摘要措辞 */
  readonly summaryKey: string
}

export const LICENSE_INFO: LicenseInfo = {
  name: 'PolyForm Noncommercial License 1.0.0',
  spdxId: 'LicenseRef-PolyForm-Noncommercial-1.0.0',
  url: 'https://polyformproject.org/licenses/noncommercial/1.0.0/',
  noncommercial: true,
  summaryKey: 'about.licenseSummary',
}
