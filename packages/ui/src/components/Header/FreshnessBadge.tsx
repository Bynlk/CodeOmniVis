/**
 * 数据新鲜度徽标
 *
 * 以颜色 + 文案可视化 fresh / analyzing / stale 三态,并展示待处理变更数。
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
      className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 rounded-lg"
      title={title}
      aria-label={t(style.labelKey)}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${style.dot}`} />
      <span className={`text-xs font-medium ${style.text}`}>{t(style.labelKey)}</span>
      {status.pendingChanges > 0 && status.state !== 'analyzing' && (
        <span className="text-xs text-slate-400">
          {t('freshness.pending', { count: status.pendingChanges })}
        </span>
      )}
    </div>
  )
}
