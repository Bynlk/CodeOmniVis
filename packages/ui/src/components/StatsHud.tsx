import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getGraphStats } from '../services'

/**
 * 常驻项目概览 HUD(feature-011 / AC-1)。
 * - 首屏无需任何点击即可看到 总节点数 / 总关系数 / 问题数。
 * - 画布右上角(z-canvas-ui),不遮挡图例(左下)与工具栏。
 * - 数据源与 Stats 面板同源(getGraphStats),WebSocket 推送刷新。
 */
export function StatsHud() {
  const { t } = useTranslation()
  const { data: stats } = useQuery({
    queryKey: ['graph-stats'],
    queryFn: getGraphStats,
    refetchInterval: 30000,
  })

  if (!stats) return null

  return (
    <div
      className="absolute right-ds-4 top-ds-4 z-canvas-ui flex items-stretch gap-ds-1 rounded-ds-lg border border-border-subtle bg-surface-overlay px-ds-1 py-ds-1 text-content shadow-ds-panel backdrop-blur-md"
      role="region"
      aria-label={t('stats.overview')}
    >
      <HudItem label={t('stats.nodes')} value={stats.nodeCount} />
      <span aria-hidden="true" className="my-1 w-px bg-border-subtle" />
      <HudItem label={t('stats.edges')} value={stats.edgeCount} />
      <span aria-hidden="true" className="my-1 w-px bg-border-subtle" />
      <HudItem label={t('issues.errors')} value={stats.errorCount} accent={stats.errorCount > 0} />
    </div>
  )
}

function HudItem({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex min-w-[3.5rem] flex-col items-center rounded-ds-sm px-ds-2 py-0.5">
      <span
        className={`text-ds-lg font-semibold leading-none tabular-nums ${accent ? 'text-rose-400' : 'text-content'}`}
      >
        {value}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-content-muted">{label}</span>
    </div>
  )
}

export default StatsHud
