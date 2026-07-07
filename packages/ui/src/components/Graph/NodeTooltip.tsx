import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import { useCytoscapeRef } from '../../lib/cytoscapeContext'
import { useUiStore, selectIsAnyModalOpen } from '../../store/uiStore'
import { isNodeType } from '@codeomnivis/shared'
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

function getStringData(node: cytoscape.NodeSingular, key: string, fallback: string): string {
  const value: unknown = node.data(key)
  return typeof value === 'string' ? value : fallback
}

function getNumberData(node: cytoscape.NodeSingular, key: string, fallback: number): number {
  const value: unknown = node.data(key)
  return typeof value === 'number' ? value : fallback
}

function getNodeType(node: cytoscape.NodeSingular): NodeType {
  const value: unknown = node.data('type')
  return typeof value === 'string' && isNodeType(value) ? value : 'module'
}

export function NodeTooltip() {
  const { t } = useTranslation()
  const cyRef = useCytoscapeRef()
  // feature-010：模态（命令面板/设置）打开时抑制 tooltip，避免盖在模态之上。
  const isAnyModalOpen = useUiStore(selectIsAnyModalOpen)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cy = cyRef?.current
    if (!cy) return

    const onMouseOver = (evt: cytoscape.EventObjectNode) => {
      const node = evt.target
      const renderedPos = node.renderedPosition()
      const container = cy.container()
      const rect = container?.getBoundingClientRect()

      if (!rect) return

      timerRef.current = setTimeout(() => {
        setTooltip({
          x: rect.left + renderedPos.x,
          y: rect.top + renderedPos.y - 20,
          nodeId: node.id(),
          type: getNodeType(node),
          name: getStringData(node, 'label', node.id()),
          filePath: getStringData(node, 'filePath', ''),
          line: getNumberData(node, 'line', 0),
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
  }, [cyRef])

  if (!tooltip || isAnyModalOpen) return null

  const emoji = NODE_EMOJI[tooltip.type] ?? '●'
  const color = NODE_COLORS[tooltip.type] ?? '#6b7280'

  return (
    <div
      className="pointer-events-none fixed z-tooltip animate-fadeIn rounded-ds-lg border border-border-strong bg-surface-overlay p-ds-3 text-ds-sm shadow-ds-panel backdrop-blur-md"
      style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}
    >
      {/* 节点类型行 */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-base">{emoji}</span>
        <span
          className="rounded-ds-sm px-1.5 py-0.5 text-ds-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {t(`nodeType.${tooltip.type}`)}
        </span>
      </div>
      {/* 节点名称 */}
      <div className="font-medium text-content">{tooltip.name}</div>
      {/* 文件路径 */}
      {tooltip.filePath && (
        <div className="mt-1 max-w-xs truncate text-ds-xs text-content-muted">
          {tooltip.filePath}
          {tooltip.line > 0 && (
            <span className="ml-1 text-content-muted">:{tooltip.line}</span>
          )}
        </div>
      )}
      {/* 入度/出度 */}
      <div className="mt-1.5 flex gap-ds-3 text-ds-xs text-content-muted">
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
