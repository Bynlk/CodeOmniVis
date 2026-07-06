import { useRef, useEffect } from 'react'
import cytoscape from 'cytoscape'
import { useTranslation } from 'react-i18next'
import type { OmniGraph } from '@codeomnivis/shared'
import { graphToCytoscapeElements } from '../utils/graphTransform'
import { getCytoscapeStyle } from '../utils/cytoscapeConfig'
import { NodeTooltip } from './Graph/NodeTooltip'

// ============================================================
// 同心圆环 + cose 力导向布局
// ============================================================

/** 类型 → 环层级（0 = 中心） */
const TYPE_RING: Record<string, number> = {
  page: 0,
  component: 1,
  api_route: 2,
  trpc_procedure: 2,
  tsrpc_service: 2,
  tsrpc_api: 2,
  tsrpc_msg: 2,
  express_route: 2,
  handler: 3,
  service: 3,
  db_model: 4,
  module: 4,
  kotlin_class: 3,
  kotlin_interface: 3,
  kotlin_object: 3,
  kotlin_function: 3,
  kotlin_route: 2,
}

/** 每环的半径 */
const RING_RADII = [0, 300, 600, 900, 1200]

/**
 * 布局主函数
 *
 * 1. 按类型把节点放到同心圆环（preset）
 * 2. 用内置 cose 物理引擎优化：
 *    - 节点有排斥力（不重叠）
 *    - 边有拉力（自动适应长度）
 */
function layoutByTypeNetwork(cy: cytoscape.Core): void {
  const nodes = cy.nodes()
  if (nodes.length === 0) return

  // ── 第一步：按类型分组，放到同心圆环 ──
  const groups = new Map<string, cytoscape.NodeSingular[]>()
  nodes.forEach(node => {
    const rawType: unknown = node.data('type')
    const type = typeof rawType === 'string' ? rawType : 'unknown'
      const group = groups.get(type) ?? []
      group.push(node)
      groups.set(type, group)
  })

  for (const [type, typeNodes] of groups) {
    const ring = TYPE_RING[type] ?? 2
    const radius = RING_RADII[ring] || 600
    const count = typeNodes.length
    if (count === 0) continue

    const effectiveRadius = ring === 0
      ? Math.max(150, count * 50)
      : radius

    const angleStep = (2 * Math.PI) / count
    typeNodes.forEach((node, i) => {
      const angle = angleStep * i - Math.PI / 2
      node.position({
        x: effectiveRadius * Math.cos(angle),
        y: effectiveRadius * Math.sin(angle),
      })
    })
  }

  // ── 第二步：cose 物理引擎 ──
  cy.layout({
    name: 'cose',
    randomize: false,
    animate: false,
    nodeRepulsion: () => 500000,
    idealEdgeLength: () => 150,
    edgeElasticity: () => 50,
    gravity: 0.01,
    numIter: 300,
    nestingFactor: 0.1,
    padding: 30,
    initialTemp: 500,
    coolingFactor: 0.95,
    minTemp: 1.0,
  }).run()
}

// ============================================================
// 组件
// ============================================================

interface GraphCanvasProps {
  graph?: OmniGraph
  selectedNode: string | null
  onNodeSelect: (nodeId: string | null) => void
  onCyInit?: (cy: cytoscape.Core) => void
}

export default function GraphCanvas({ graph, selectedNode, onNodeSelect, onCyInit }: GraphCanvasProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const onNodeSelectRef = useRef(onNodeSelect)
  const onCyInitRef = useRef(onCyInit)

  // 保持 ref 最新，避免 useEffect 依赖函数引用
  onNodeSelectRef.current = onNodeSelect
  onCyInitRef.current = onCyInit

  // 初始化 Cytoscape 实例（仅在 mount 时执行一次）
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: getCytoscapeStyle(),
      layout: { name: 'null' },
      minZoom: 0.05,
      maxZoom: 3,
    })

    cyRef.current = cy
    onCyInitRef.current?.(cy)

    cy.on('tap', (event) => {
      if (event.target === cy) {
        onNodeSelectRef.current(null)
      }
    })

    cy.on('tap', 'node', (event: cytoscape.EventObjectNode) => {
      onNodeSelectRef.current(event.target.id())
    })

    // 容器尺寸变化(如分析面板 dock 开合导致画布收窄/展开)时,
    // 同步 Cytoscape 视口,避免布局错乱(feature-004 AC1 风险项)。
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        cy.resize()
      })
    })
    ro.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cy.destroy()
      cyRef.current = null
    }
  }, []) // 空依赖，仅 mount 时执行

  // 更新图数据
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !graph) return

    const elements = graphToCytoscapeElements(graph)

    cy.elements().remove()
    cy.add(elements)

    // 布局
    layoutByTypeNetwork(cy)

    // 适应视图
    cy.fit(undefined, 50)
  }, [graph])

  // 高亮选中节点
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('selected highlighted')

    if (selectedNode) {
      const selected = cy.getElementById(selectedNode)
      if (selected.length > 0) {
        selected.addClass('selected')
        const neighborhood = selected.neighborhood()
        neighborhood.addClass('highlighted')
        selected.addClass('highlighted')
      }
    }
  }, [selectedNode])

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label={t('graph.canvasLabel')}
        role="img"
      />
      <NodeTooltip />
    </>
  )
}
