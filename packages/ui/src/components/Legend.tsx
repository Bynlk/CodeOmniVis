import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeType, OmniGraph } from '@codeomnivis/shared'
import { NODE_COLORS, NODE_EMOJI, NODE_TYPE_LIST } from '../lib/nodeConfig'
import { useUiStore } from '../store/uiStore'

interface LegendProps {
  /** 传入当前图谱时,只展示实际出现的节点类型;不传则展示全部 17 种。 */
  graph?: OmniGraph
}

/**
 * 常驻图例(feature-003)。
 *
 * - 颜色/emoji 单一真源:直接读取 nodeConfig(NODE_COLORS / NODE_EMOJI),
 *   与 Cytoscape 画布 stylesheet 取自同一处,保证图例与画布渲染 100% 一致。
 * - 默认展开、可折叠,折叠态记忆在 uiStore(持久化到 localStorage)。
 * - 放在画布左下角,避开右上工具条,不遮挡关键操作区。
 */
export function Legend({ graph }: LegendProps) {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.isLegendCollapsed)
  const toggleLegend = useUiStore((s) => s.toggleLegend)

  // 仅展示图谱中实际出现的节点类型(按固定顺序),无图谱时展示全部。
  const types = useMemo<NodeType[]>(() => {
    if (!graph) return NODE_TYPE_LIST
    const present = new Set(graph.nodes.map((n) => n.type))
    const filtered = NODE_TYPE_LIST.filter((tp) => present.has(tp))
    return filtered.length > 0 ? filtered : NODE_TYPE_LIST
  }, [graph])

  return (
    <div
      className="absolute bottom-ds-4 left-ds-4 z-canvas-ui rounded-ds-md border border-slate-700
                 bg-slate-800/90 shadow-ds-panel backdrop-blur-sm text-ds-xs text-slate-200"
      role="region"
      aria-label={t('legend.title')}
    >
      <button
        type="button"
        onClick={() => toggleLegend()}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t('legend.expand') : t('legend.collapse')}
        className="flex w-full items-center justify-between gap-ds-3 px-ds-3 py-ds-2
                   font-medium text-slate-100 hover:bg-slate-700/60 rounded-ds-md
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span>{t('legend.title')}</span>
        <span aria-hidden="true" className="text-slate-400">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <ul className="max-h-64 overflow-auto px-ds-3 pb-ds-2 pt-ds-1 space-y-ds-1">
          {types.length === 0 ? (
            <li className="text-slate-400">{t('legend.empty')}</li>
          ) : (
            types.map((type) => (
              <li key={type} className="flex items-center gap-ds-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/20"
                  style={{ backgroundColor: NODE_COLORS[type] }}
                  aria-hidden="true"
                />
                <span aria-hidden="true">{NODE_EMOJI[type]}</span>
                <span>{t(`nodeType.${type}`)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default Legend
