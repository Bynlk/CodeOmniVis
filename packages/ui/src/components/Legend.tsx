import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EdgeType, NodeType, OmniGraph } from '@codeomnivis/shared'
import { NODE_COLORS, NODE_EMOJI, NODE_TYPE_LIST } from '../lib/nodeConfig'
import { EDGE_COLORS, EDGE_EMOJI, EDGE_TYPE_LIST } from '../lib/edgeConfig'
import { useUiStore } from '../store/uiStore'

interface LegendProps {
  /** 传入当前图谱时,只展示实际出现的类型;不传则展示全部。 */
  graph?: OmniGraph
}

/**
 * 常驻图例(feature-011 重写)。
 * - 颜色/emoji 单一真源:节点读 nodeConfig,边读 edgeConfig,与画布同源。
 * - 同时展示 17 种 NodeType 与 15 种 EdgeType(颜色 + emoji + 名称)。
 * - 默认展开、可折叠,折叠态记忆在 uiStore(持久化)。
 * - 画布左下角(z-canvas-ui),避开工具栏,不遮挡关键操作区。
 */
export function Legend({ graph }: LegendProps) {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.isLegendCollapsed)
  const toggleLegend = useUiStore((s) => s.toggleLegend)

  const nodeTypes = useMemo<NodeType[]>(() => {
    if (!graph) return NODE_TYPE_LIST
    const present = new Set(graph.nodes.map((n) => n.type))
    const filtered = NODE_TYPE_LIST.filter((tp) => present.has(tp))
    return filtered.length > 0 ? filtered : NODE_TYPE_LIST
  }, [graph])

  const edgeTypes = useMemo<EdgeType[]>(() => {
    if (!graph) return EDGE_TYPE_LIST
    const present = new Set(graph.edges.map((e) => e.type))
    const filtered = EDGE_TYPE_LIST.filter((tp) => present.has(tp))
    return filtered.length > 0 ? filtered : EDGE_TYPE_LIST
  }, [graph])

  return (
    <div
      className="absolute bottom-ds-4 left-ds-4 z-canvas-ui w-52 overflow-hidden rounded-ds-lg border border-border-subtle bg-surface-overlay text-ds-xs text-content shadow-ds-panel backdrop-blur-md"
      role="region"
      aria-label={t('legend.title')}
    >
      <button
        type="button"
        onClick={() => toggleLegend()}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t('legend.expand') : t('legend.collapse')}
        className="flex w-full items-center justify-between gap-ds-3 px-ds-3 py-ds-2 font-semibold text-content transition-colors hover:bg-surface-hover/60"
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">🏷️</span>
          {t('legend.title')}
        </span>
        <span aria-hidden="true" className="text-content-muted">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <div className="max-h-72 overflow-auto border-t border-border-subtle px-ds-2 py-ds-2">
          <p className="px-ds-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
            {t('legend.nodes')}
          </p>
          <ul className="space-y-0.5">
            {nodeTypes.length === 0 ? (
              <li className="px-ds-1 text-content-muted">{t('legend.empty')}</li>
            ) : (
              nodeTypes.map((type) => (
                <li key={type} className="flex items-center gap-ds-2 rounded-ds-sm px-ds-1 py-0.5">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/20"
                    style={{ backgroundColor: NODE_COLORS[type] }}
                    aria-hidden="true"
                  />
                  <span aria-hidden="true">{NODE_EMOJI[type]}</span>
                  <span className="truncate text-content-secondary">{t(`nodeType.${type}`)}</span>
                </li>
              ))
            )}
          </ul>

          <p className="mt-ds-2 px-ds-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
            {t('legend.edges')}
          </p>
          <ul className="space-y-0.5">
            {edgeTypes.length === 0 ? (
              <li className="px-ds-1 text-content-muted">{t('legend.empty')}</li>
            ) : (
              edgeTypes.map((type) => (
                <li key={type} className="flex items-center gap-ds-2 rounded-ds-sm px-ds-1 py-0.5">
                  <span
                    className="inline-block h-0.5 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: EDGE_COLORS[type] }}
                    aria-hidden="true"
                  />
                  <span aria-hidden="true">{EDGE_EMOJI[type]}</span>
                  <span className="truncate text-content-secondary">{t(`edgeType.${type}`)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default Legend
