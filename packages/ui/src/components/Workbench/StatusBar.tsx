import { useTranslation } from 'react-i18next'
import type { FreshnessStatus } from '@codeomnivis/shared'
import { useUiStore } from '../../store/uiStore'

interface StatusBarProps { status: FreshnessStatus; nodeCount: number; edgeCount: number }

export function StatusBar({ status, nodeCount, edgeCount }: StatusBarProps) {
  const { t } = useTranslation()
  const wsStatus = useUiStore(state => state.wsStatus)
  const stateColor = status.state === 'fresh' ? 'bg-emerald-400' : status.state === 'analyzing' ? 'bg-amber-400' : 'bg-slate-400'
  const freshnessLabel = status.lastAnalyzedAt === null
    ? t('freshness.never', 'Not analyzed yet')
    : t(`freshness.${status.state}`, status.state)
  return (
    <div className="flex h-full items-center justify-between px-2.5 font-mono text-[10px] text-content-muted">
      <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${stateColor}`} />{freshnessLabel}</span><span>{t(`ws.${wsStatus}`, wsStatus)}</span></div>
      <div className="flex items-center gap-4"><span>{t('workbench.count.nodes', { defaultValue: `${nodeCount} nodes`, count: nodeCount })}</span><span>{t('workbench.count.edges', { defaultValue: `${edgeCount} edges`, count: edgeCount })}</span><span className="hidden sm:inline">{t('workbench.shortcut.search', '⌘K search')}</span><span className="hidden lg:inline">{t('workbench.shortcut.navigate', '↑↓ navigate')}</span></div>
    </div>
  )
}
