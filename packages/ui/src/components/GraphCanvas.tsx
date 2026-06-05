import { useRef, useEffect } from 'react'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import type { OmniGraph } from '@omnivis/shared'
import { NODE_COLORS } from '@omnivis/shared'
import { graphToCytoscapeElements } from '../utils/graphTransform'
import { getCytoscapeStyle } from '../utils/cytoscapeConfig'

// 注册 dagre 布局
cytoscape.use(dagre)

interface GraphCanvasProps {
  graph?: OmniGraph
  selectedNode: string | null
  onNodeSelect: (nodeId: string | null) => void
}

export default function GraphCanvas({ graph, selectedNode, onNodeSelect }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  // 初始化 Cytoscape 实例
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: getCytoscapeStyle(),
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        rankSep: 100,
        nodeSep: 50,
      },
      minZoom: 0.1,
      maxZoom: 3,
    })

    cyRef.current = cy

    // 点击空白处取消选择
    cy.on('tap', (event) => {
      if (event.target === cy) {
        onNodeSelect(null)
      }
    })

    // 点击节点选择
    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id()
      onNodeSelect(nodeId)
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [onNodeSelect])

  // 更新图数据
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !graph) return

    // 转换图数据为 Cytoscape 元素
    const elements = graphToCytoscapeElements(graph)

    // 清空并重新加载
    cy.elements().remove()
    cy.add(elements)

    // 应用布局
    cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      rankSep: 100,
      nodeSep: 50,
    }).run()

    // 适应视图
    cy.fit(undefined, 50)
  }, [graph])

  // 高亮选中的节点
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    // 重置所有节点样式
    cy.elements().removeClass('selected highlighted')

    if (selectedNode) {
      const selected = cy.getElementById(selectedNode)
      if (selected.length > 0) {
        selected.addClass('selected')

        // 高亮相关节点和边
        const neighborhood = selected.neighborhood()
        neighborhood.addClass('highlighted')
        selected.addClass('highlighted')
      }
    }
  }, [selectedNode])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Graph visualization canvas"
      role="img"
    />
  )
}
