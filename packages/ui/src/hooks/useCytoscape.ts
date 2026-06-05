/**
 * Cytoscape 实例管理 Hook
 *
 * 管理 Cytoscape.js 实例的创建和销毁。
 */

import { useRef, useEffect, useCallback } from 'react'
import cytoscape from 'cytoscape'
import type { OmniGraph } from '@omnivis/shared'
import { graphToCytoscapeElements } from '../utils/graphTransform'
import { getCytoscapeStyle } from '../utils/cytoscapeConfig'

interface UseCytoscapeOptions {
  container: React.RefObject<HTMLDivElement>
  graph?: OmniGraph
  onNodeSelect?: (nodeId: string | null) => void
}

export function useCytoscape({ container, graph, onNodeSelect }: UseCytoscapeOptions) {
  const cyRef = useRef<cytoscape.Core | null>(null)

  // 初始化 Cytoscape
  useEffect(() => {
    if (!container.current) return

    const cy = cytoscape({
      container: container.current,
      style: getCytoscapeStyle(),
      minZoom: 0.1,
      maxZoom: 3,
    })

    cyRef.current = cy

    // 事件绑定
    cy.on('tap', (event) => {
      if (event.target === cy) {
        onNodeSelect?.(null)
      }
    })

    cy.on('tap', 'node', (event) => {
      onNodeSelect?.(event.target.id())
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [container, onNodeSelect])

  // 更新图数据
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !graph) return

    const elements = graphToCytoscapeElements(graph)

    cy.elements().remove()
    cy.add(elements)

    cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      rankSep: 100,
      nodeSep: 50,
    }).run()

    cy.fit(undefined, 50)
  }, [graph])

  // 高亮选中节点
  const highlightNode = useCallback((nodeId: string | null) => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('selected highlighted')

    if (nodeId) {
      const node = cy.getElementById(nodeId)
      if (node.length > 0) {
        node.addClass('selected')
        node.neighborhood().addClass('highlighted')
        node.addClass('highlighted')
      }
    }
  }, [])

  // 适应视图
  const fitView = useCallback(() => {
    cyRef.current?.fit(undefined, 50)
  }, [])

  // 运行布局
  const runLayout = useCallback(() => {
    cyRef.current?.layout({
      name: 'dagre',
      rankDir: 'TB',
      rankSep: 100,
      nodeSep: 50,
    }).run()
  }, [])

  return {
    cy: cyRef.current,
    highlightNode,
    fitView,
    runLayout,
  }
}
