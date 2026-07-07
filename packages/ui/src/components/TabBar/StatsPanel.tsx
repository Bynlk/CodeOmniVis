import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import { isNodeType } from '@codeomnivis/shared'
import type { NodeType } from '@codeomnivis/shared'
import { getGraphStats } from '../../services'

const SECTION_TITLE =
  'mb-ds-3 text-[10px] font-semibold uppercase tracking-wider text-content-muted'

export function StatsPanel() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['graph-stats'],
    queryFn: getGraphStats,
    refetchInterval: 30000, // 主要依赖 WebSocket 推送
  })

  if (isLoading) {
    return <div className="p-ds-4 text-ds-sm text-content-muted">{t('stats.loading')}</div>
  }

  if (error || !stats) {
    return <div className="p-ds-4 text-ds-sm text-rose-400">{t('stats.failedToLoad')}</div>
  }

  const nodeTypes: Array<[NodeType, number]> = Object.entries(stats.nodeTypeCounts)
    .filter((entry): entry is [NodeType, number] => isNodeType(entry[0]))
  const totalNodes = stats?.nodeCount ?? 0
  // module 是聚合节点，不是孤立节点；暂时显示 0，后续需要从 API 获取真实孤立节点数
  const isolatedCount = 0

  return (
    <div className="grid grid-cols-1 gap-ds-5 p-ds-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 总览 */}
      <div>
        <h3 className={SECTION_TITLE}>{t('stats.overview')}</h3>
        <div className="space-y-ds-2">
          <StatItem label={t('stats.nodes')} value={stats?.nodeCount ?? '—'} />
          <StatItem label={t('stats.edges')} value={stats?.edgeCount ?? '—'} />
          <StatItem label={t('stats.isolated')} value={isolatedCount} />
          <StatItem
            label={t('stats.coverage')}
            value={`${totalNodes > 0 ? Math.round(((totalNodes - isolatedCount) / totalNodes) * 100) : 0}%`}
          />
        </div>
      </div>

      {/* 节点类型分布 */}
      <div className="lg:col-span-2">
        <h3 className={SECTION_TITLE}>{t('filter.nodeTypes')}</h3>
        <div className="space-y-1.5">
          {nodeTypes
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-ds-2 text-ds-sm">
                <span className="w-5 text-center">{NODE_EMOJI[type] ?? '●'}</span>
                <span
                  className="h-2 rounded-full"
                  style={{
                    width: `${totalNodes > 0 ? Math.max(8, (count / totalNodes) * 200) : 8}px`,
                    backgroundColor: NODE_COLORS[type] ?? '#6b7280',
                  }}
                />
                <span className="min-w-[80px] text-content-secondary">{t(`nodeType.${type}`)}</span>
                <span className="ml-auto text-content-muted">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 边类型分布 */}
      <div>
        <h3 className={SECTION_TITLE}>{t('filter.edgeTypes')}</h3>
        <div className="space-y-1.5">
          {Object.entries(stats?.edgeTypeCounts ?? {})
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-ds-2 text-ds-sm">
                <span className="text-content-secondary">{t(`edgeType.${type}`)}</span>
                <span className="ml-auto text-content-muted">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-ds-md bg-surface-hover/50 px-ds-3 py-1.5">
      <span className="text-ds-sm text-content-muted">{label}</span>
      <span className="text-ds-sm font-semibold text-content">{value}</span>
    </div>
  )
}
