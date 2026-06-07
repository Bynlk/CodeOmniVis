import { useTranslation } from 'react-i18next'
import { NODE_TYPE_LIST, NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import { EDGE_TYPE_LIST } from '../../lib/edgeConfig'
import { useGraphFilter } from '../../hooks/useGraphFilter'
import { FilterChip } from './FilterChip'
import type { NodeType, EdgeType } from '@codeomnivis/shared'

export function FilterPanel() {
  const { t } = useTranslation()
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

  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {/* 节点类型 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.nodeTypes')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {NODE_TYPE_LIST.map((type: NodeType) => (
            <FilterChip
              key={type}
              active={nodeTypeFilter.has(type)}
              color={NODE_COLORS[type]}
              emoji={NODE_EMOJI[type]}
              label={t(`nodeType.${type}`)}
              onClick={() => toggleNodeType(type)}
            />
          ))}
        </div>
      </div>

      {/* 边类型 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.edgeTypes')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {EDGE_TYPE_LIST.map((type: EdgeType) => (
            <FilterChip
              key={type}
              active={edgeTypeFilter.has(type)}
              label={t(`edgeType.${type}`)}
              onClick={() => toggleEdgeType(type)}
            />
          ))}
        </div>
      </div>

      {/* 置信度 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.confidence')}
        </h3>
        <div className="flex gap-1.5">
          {(['certain', 'inferred'] as const).map(c => (
            <FilterChip
              key={c}
              active={confidenceFilter.has(c)}
              label={t(`confidence.${c}`)}
              onClick={() => toggleConfidence(c)}
            />
          ))}
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
