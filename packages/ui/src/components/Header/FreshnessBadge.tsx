/**
 * 数据新鲜度徽标(feature-011 重写)。
 * 以颜色点 + 文案可视化 fresh / analyzing / stale 三态,并展示待处理变更数。
 */
import { useTranslation } from 'react-i18next'
import type { FreshnessStatus } from '@codeomnivis/shared'

interface FreshnessBadgeProps {
  status: FreshnessStatus
}

interface BadgeStyle {
  dot: string
  text: string
  labelKey: string
}

function styleFor(state: FreshnessStatus['state']): BadgeStyle {
  switch (state) {
    case 'fresh':
      return { dot: 'bg-emerald-400', text: 'text-emerald-300', labelKey: 'freshness.fresh' }
    case 'analyzing':
      return { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', labelKey: 'freshness.analyzing' }
    case 'stale':
      return { dot: 'bg-rose-400', text: 'text-rose-300', labelKey: 'freshness.stale' }
  }
}

export function FreshnessBadge({ status }: FreshnessBadgeProps) {
  const { t } = useTranslation()
  const style = styleFor(status.state)

  const title =
    status.lastAnalyzedAt === null
      ? t('freshness.never')
      : t('freshness.lastAnalyzed', { time: new Date(status.lastAnalyzedAt).toLocaleTimeString() })

  return (
    <div
      className="flex items-center gap-1.5 rounded-ds-md border border-border-subtle bg-surface px-ds-3 py-1.5"
      title={title}
      aria-label={t(style.labelKey)}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
      <span className={`text-ds-xs font-medium ${style.text}`}>{t(style.labelKey)}</span>
      {status.pendingChanges > 0 && status.state !== 'analyzing' && (
        <span className="text-ds-xs text-content-muted">
          {t('freshness.pending', { count: status.pendingChanges })}
        </span>
      )}
    </div>
  )
}
