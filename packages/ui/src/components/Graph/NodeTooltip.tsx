import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import { useCytoscapeRef } from '../../lib/cytoscapeContext'
import type { NodeType } from '@codeomnivis/shared'
import type cytoscape from 'cytoscape'

interface TooltipData {
  x: number
  y: number
  nodeId: string
  type: NodeType
  name: string
  filePath: string
  line: number
  edgeCount: { in: number; out: number }
}

const HOVER_DELAY_MS = 600

export function NodeTooltip() {
  const { t } = useTranslation()
  const cyRef = useCytoscapeRef()
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cy = cyRef?.current
    if (!cy) return

    const onMouseOver = (evt: cytoscape.EventObject) => {
      const node = evt.target as cytoscape.NodeSingular
      const renderedPos = node.renderedPosition()
      const container = cy.container()
      const rect = container?.getBoundingClientRect()

      if (!rect) return

      timerRef.current = setTimeout(() => {
        setTooltip({
          x: rect.left + renderedPos.x,
          y: rect.top + renderedPos.y - 20,
          nodeId: node.id(),
          type: node.data('type') as NodeType,
          name: (node.data('label') as string) ?? node.id(),
          filePath: (node.data('filePath') as string) ?? '',
          line: (node.data('line') as number) ?? 0,
          edgeCount: {
            in: node.indegree(false),
            out: node.outdegree(false),
          },
        })
      }, HOVER_DELAY_MS)
    }

    const onMouseOut = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setTooltip(null)
    }

    cy.on('tap', 'node', onMouseOut)
    cy.on('mouseover', 'node', onMouseOver)
    cy.on('mouseout', 'node', onMouseOut)

    return () => {
      cy.off('mouseover', 'node', onMouseOver)
      cy.off('mouseout', 'node', onMouseOut)
      cy.off('tap', 'node', onMouseOut)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [cyRef]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!tooltip) return null

  const emoji = NODE_EMOJI[tooltip.type] ?? '●'
  const color = NODE_COLORS[tooltip.type] ?? '#6b7280'

  return (
    <div
      className="fixed z-50 rounded-lg border border-slate-600 bg-slate-800
                 p-3 shadow-xl text-sm pointer-events-none
                 animate-fadeIn"
      style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}
    >
      {/* 节点类型行 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">{emoji}</span>
        <span
          className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {t(`nodeType.${tooltip.type}`)}
        </span>
      </div>
      {/* 节点名称 */}
      <div className="font-medium text-white">{tooltip.name}</div>
      {/* 文件路径 */}
      {tooltip.filePath && (
        <div className="mt-1 text-xs text-slate-400 max-w-xs truncate">
          {tooltip.filePath}
          {tooltip.line > 0 && (
            <span className="ml-1 text-slate-500">:{tooltip.line}</span>
          )}
        </div>
      )}
      {/* 入度/出度 */}
      <div className="mt-1.5 flex gap-3 text-xs text-slate-400">
        <span>
          ↙ {tooltip.edgeCount.in} {t('tooltip.in')}
        </span>
        <span>
          ↗ {tooltip.edgeCount.out} {t('tooltip.out')}
        </span>
      </div>
    </div>
  )
}
