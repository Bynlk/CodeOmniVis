import { useEffect } from 'react'
import type { TraceStep } from '@codeomnivis/shared'
import { useCytoscapeInstance } from '../../lib/cytoscapeContext'
import { buildEdgeIndex, findConnectingEdges, type EdgeRef } from '../../lib/traceIndex'

interface TraceRunnerProps {
  steps: TraceStep[]
  /** 当前点亮到第几站(0-based);-1 表示熄灭。 */
  activeIndex: number
}

/**
 * 循迹光点(纯副作用组件,无 DOM 输出)。
 *
 * 根据 activeIndex 在 cytoscape 上点亮链路:
 * - 已走过的节点/边加 trace-path(暗黄)
 * - 当前站点加 trace-active(亮黄光点)并居中聚焦
 * 卸载或 activeIndex<0 时清除所有 trace-* class。
 */
export function TraceRunner({ steps, activeIndex }: TraceRunnerProps) {
  const cy = useCytoscapeInstance()

  useEffect(() => {
    if (cy === null) return

    cy.batch(() => {
      cy.elements().removeClass('trace-active trace-path')

      if (activeIndex < 0 || steps.length === 0) return

      const upto = Math.min(activeIndex, steps.length - 1)
      // M2:预建一次入射索引,每步 O(degree) 查找,替代每步全边扫描。
      const edgeRefs: EdgeRef[] = cy.edges().map(edge => ({
        id: edge.id(),
        source: edge.source().id(),
        target: edge.target().id(),
      }))
      const edgeIndex = buildEdgeIndex(edgeRefs)
      let prevId: string | null = null

      for (let i = 0; i <= upto; i++) {
        const step = steps[i]
        const node = cy.getElementById(step.nodeId)
        if (node.length > 0) node.addClass('trace-path')

        if (prevId !== null) {
          // 点亮 prev↔cur 之间的边(无向匹配,容忍方向)
          for (const hit of findConnectingEdges(edgeIndex, prevId, step.nodeId)) {
            cy.getElementById(hit.id).addClass('trace-path')
          }
        }
        prevId = step.nodeId
      }

      // 当前站点高亮 + 聚焦
      const current = steps[upto]
      const curNode = cy.getElementById(current.nodeId)
      if (curNode.length > 0) {
        curNode.removeClass('trace-path')
        curNode.addClass('trace-active')
        cy.animate({ center: { eles: curNode }, duration: 250 })
      }
    })

    return () => {
      cy.elements().removeClass('trace-active trace-path')
    }
  }, [cy, steps, activeIndex])

  return null
}
