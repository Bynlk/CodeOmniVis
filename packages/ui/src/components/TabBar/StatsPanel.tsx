import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import type { NodeType } from '@codeomnivis/shared'

interface StatsResponse {
  nodeCount: number
  edgeCount: number
  errorCount: number
  nodeTypeCounts: Record<string, number>
  edgeTypeCounts: Record<string, number>
}

async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch('/api/graph/stats')
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`)
  const json = await res.json()
  return json.data as StatsResponse
}

export function StatsPanel() {
  const { t } = useTranslation()
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['graph-stats'],
    queryFn: fetchStats,
    refetchInterval: 30000, // 主要依赖 WebSocket 推送
  })

  if (isLoading) {
    return <div className="p-4 text-slate-400 text-sm">{t('stats.loading')}</div>
  }

  if (error || !stats) {
    return <div className="p-4 text-red-400 text-sm">{t('stats.failedToLoad')}</div>
  }

  const nodeTypes = Object.entries(stats?.nodeTypeCounts ?? {}) as [NodeType, number][]
  const totalNodes = stats?.nodeCount ?? 0
  // module 是聚合节点，不是孤立节点；暂时显示 0，后续需要从 API 获取真实孤立节点数
  const isolatedCount = 0

  return (
    <div className="p-4 grid grid-cols-4 gap-6">
      {/* 总览 */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('stats.overview')}
        </h3>
        <div className="space-y-2">
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
      <div className="col-span-2">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.nodeTypes')}
        </h3>
        <div className="space-y-1.5">
          {nodeTypes
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center">{NODE_EMOJI[type] ?? '●'}</span>
                <span
                  className="h-2 rounded-full"
                  style={{
                    width: `${totalNodes > 0 ? Math.max(8, (count / totalNodes) * 200) : 8}px`,
                    backgroundColor: NODE_COLORS[type] ?? '#6b7280',
                  }}
                />
                <span className="text-slate-300 min-w-[80px]">{t(`nodeType.${type}`)}</span>
                <span className="text-slate-500 ml-auto">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 边类型分布 */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.edgeTypes')}
        </h3>
        <div className="space-y-1.5">
          {Object.entries(stats?.edgeTypeCounts ?? {})
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span className="text-slate-300">{t(`edgeType.${type}`)}</span>
                <span className="text-slate-500 ml-auto">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  )
}
