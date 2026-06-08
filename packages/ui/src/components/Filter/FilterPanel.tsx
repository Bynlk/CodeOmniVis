import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import { useGraphFilter } from '../../hooks/useGraphFilter'
import { useGraph } from '../../hooks/useGraph'
import { FilterChip } from './FilterChip'
import type { NodeType, EdgeType } from '@codeomnivis/shared'

export function FilterPanel() {
  const { t } = useTranslation()
  const { data: graph } = useGraph()
  const {
    nodeTypeFilter,
    toggleNodeType,
    edgeTypeFilter,
    toggleEdgeType,
    confidenceFilter,
    toggleConfidence,
    showIsolated,
    setShowIsolated,
    resetFilters,
  } = useGraphFilter()

  // 从图数据中提取实际存在的类型及其计数
  const nodeTypeCounts = useMemo(() => {
    if (!graph) return new Map<NodeType, number>()
    const counts = new Map<NodeType, number>()
    for (const n of graph.nodes) {
      counts.set(n.type as NodeType, (counts.get(n.type as NodeType) ?? 0) + 1)
    }
    return counts
  }, [graph])

  const edgeTypeCounts = useMemo(() => {
    if (!graph) return new Map<EdgeType, number>()
    const counts = new Map<EdgeType, number>()
    for (const e of graph.edges) {
      counts.set(e.type as EdgeType, (counts.get(e.type as EdgeType) ?? 0) + 1)
    }
    return counts
  }, [graph])

  const confidenceCounts = useMemo(() => {
    if (!graph) return new Map<string, number>()
    const counts = new Map<string, number>()
    for (const e of graph.edges) {
      const c = e.confidence ?? 'certain'
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return counts
  }, [graph])

  // 只显示图中实际存在的类型，按计数降序排列
  const presentNodeTypes = useMemo(() =>
    [...nodeTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type),
    [nodeTypeCounts]
  )

  const presentEdgeTypes = useMemo(() =>
    [...edgeTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type),
    [edgeTypeCounts]
  )

  const presentConfidences = useMemo(() =>
    [...confidenceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c as 'certain' | 'inferred'),
    [confidenceCounts]
  )

  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {/* 节点类型 — 只显示图中有的 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.nodeTypes')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {presentNodeTypes.map((type) => (
            <FilterChip
              key={type}
              active={nodeTypeFilter.has(type)}
              color={NODE_COLORS[type]}
              emoji={NODE_EMOJI[type]}
              label={`${t(`nodeType.${type}`)} (${nodeTypeCounts.get(type)})`}
              onClick={() => toggleNodeType(type)}
            />
          ))}
          {presentNodeTypes.length === 0 && (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>
      </div>

      {/* 边类型 — 只显示图中有的 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.edgeTypes')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {presentEdgeTypes.map((type) => (
            <FilterChip
              key={type}
              active={edgeTypeFilter.has(type)}
              label={`${t(`edgeType.${type}`)} (${edgeTypeCounts.get(type)})`}
              onClick={() => toggleEdgeType(type)}
            />
          ))}
          {presentEdgeTypes.length === 0 && (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>
      </div>

      {/* 置信度 — 只显示图中有的 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.confidence')}
        </h3>
        <div className="flex gap-1.5">
          {presentConfidences.map(c => (
            <FilterChip
              key={c}
              active={confidenceFilter.has(c)}
              label={`${t(`confidence.${c}`)} (${confidenceCounts.get(c)})`}
              onClick={() => toggleConfidence(c)}
            />
          ))}
          {presentConfidences.length === 0 && (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>
      </div>

      {/* 其他 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.display')}
        </h3>
        <FilterChip
          active={showIsolated}
          label={t('filter.showIsolated')}
          onClick={() => setShowIsolated(!showIsolated)}
        />
        <button
          onClick={resetFilters}
          className="mt-2 w-full rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700"
        >
          {t('filter.reset')}
        </button>
      </div>
    </div>
  )
}
