/**
 * 图数据转换工具
 *
 * 将 OmniGraph 转换为 Cytoscape.js 的元素格式。
 */

import type { OmniGraph, OmniNode, OmniEdge } from '@omnivis/shared'
import { NODE_COLORS } from '@omnivis/shared'

// ============================================================
// 类型定义
// ============================================================

interface CytoscapeNode {
  group: 'nodes'
  data: {
    id: string
    label: string
    type: string
    filePath: string
    line: number
    metadata: Record<string, unknown>
    color: string
  }
  position?: { x: number; y: number }
}

interface CytoscapeEdge {
  group: 'edges'
  data: {
    id: string
    source: string
    target: string
    type: string
    confidence: string
    metadata: Record<string, unknown>
  }
}

type CytoscapeElement = CytoscapeNode | CytoscapeEdge

// ============================================================
// 转换函数
// ============================================================

/**
 * 将 OmniGraph 转换为 Cytoscape 元素数组
 */
export function graphToCytoscapeElements(graph: OmniGraph): CytoscapeElement[] {
  const elements: CytoscapeElement[] = []

  // 转换节点
  for (const node of graph.nodes) {
    elements.push(nodeToCytoscape(node))
  }

  // 转换边
  for (const edge of graph.edges) {
    elements.push(edgeToCytoscape(edge))
  }

  return elements
}

/**
 * 将单个节点转换为 Cytoscape 节点
 */
function nodeToCytoscape(node: OmniNode): CytoscapeNode {
  return {
    group: 'nodes',
    data: {
      id: node.id,
      label: node.name,
      type: node.type,
      filePath: node.filePath,
      line: node.line,
      metadata: node.metadata as Record<string, unknown>,
      color: NODE_COLORS[node.type] || '#94a3b8',
    },
  }
}

/**
 * 将单个边转换为 Cytoscape 边
 */
function edgeToCytoscape(edge: OmniEdge): CytoscapeEdge {
  return {
    group: 'edges',
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      confidence: edge.confidence,
      metadata: edge.metadata as Record<string, unknown>,
    },
  }
}
