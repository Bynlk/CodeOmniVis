/**
 * Cytoscape.js 配置
 *
 * 定义节点和边的样式，用于 ER 图可视化。
 * 节点 label 带 Emoji 前缀，inferred 边用虚线。
 */

import type { NodeType, EdgeType } from '@codeomnivis/shared'
import { isNodeType } from '@codeomnivis/shared'
import { NODE_EMOJI, NODE_COLORS } from '../lib/nodeConfig'
import { EDGE_COLORS, EDGE_TYPE_LIST } from '../lib/edgeConfig'

function getNodeType(node: cytoscape.NodeSingular): NodeType | undefined {
  const type: unknown = node.data('type')
  return typeof type === 'string' && isNodeType(type) ? type : undefined
}

function getNodeLabel(node: cytoscape.NodeSingular): string | undefined {
  const label: unknown = node.data('label')
  return typeof label === 'string' ? label : undefined
}

/**
 * 获取 Cytoscape 样式配置
 *
 * 使用 `satisfies` 保留 Cytoscape 样式检查，同时避免把整个样式块断言掉。
 */
/** 各边类型在颜色之外的专属视觉(线宽/线型/透明度);颜色统一由 EDGE_COLORS 提供。 */
const EDGE_TYPE_EXTRAS: Partial<Record<EdgeType, cytoscape.Css.Edge>> = {
  renders:           { 'width': 1.5 },
  calls_api:         { 'width': 2 },
  queries_db:        { 'width': 2 },
  kotlin_inherits:   { 'line-style': 'dashed' },
  kotlin_implements: { 'line-style': 'dashed' },
  kotlin_uses:       { 'opacity': 0.5 },
  sends_msg:         { 'line-style': 'dashed', 'width': 2 },
  listens_msg:       { 'line-style': 'dashed', 'width': 2 },
  contains:          { 'line-style': 'dotted' },
  data_flows_to:     { 'width': 2 },
  imports:           { 'opacity': 0.3 },
}

export function getCytoscapeStyle(): cytoscape.StylesheetJson {
  return [
    // 节点基础样式 — emoji + 文字在节点内
    {
      selector: 'node',
      style: {
        'background-color': (node: cytoscape.NodeSingular) => {
          const type = getNodeType(node)
          return type ? NODE_COLORS[type] : '#6b7280'
        },
        'label': (node: cytoscape.NodeSingular) => {
          const type = getNodeType(node)
          const label = getNodeLabel(node)
          const emoji = type ? NODE_EMOJI[type] : '●'
          const displayName = label && label.length > 16 ? label.slice(0, 14) + '…' : label ?? '?'
          return `${emoji} ${displayName}`
        },
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '10px',
        'font-weight': 500,
        'color': '#ffffff',
        'text-outline-color': '#000000',
        'text-outline-width': 2,
        'text-wrap': 'wrap',
        'text-max-width': '100px',
        'width': 80,
        'height': 40,
        'padding': '8px',
        'shape': 'roundrectangle',
        'corner-radius': '8',
      } satisfies cytoscape.Css.Node,
    },

    // 节点类型样式（保留特化样式）
    {
      selector: 'node[type="db_model"]',
      style: {
        'border-width': 2,
        'border-color': '#f472b6',
      } satisfies cytoscape.Css.Node,
    },

    // 边基础样式
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'control-point-step-size': 40,
        'arrow-scale': 0.7,
        'opacity': 0.7,
      } satisfies cytoscape.Css.Edge,
    },

    // 边类型样式 — 颜色取自 edgeConfig.EDGE_COLORS(单一真源),此处只叠加各类型专属的线宽/线型/透明度。
    ...EDGE_TYPE_LIST.map((type) => {
      const extras = EDGE_TYPE_EXTRAS[type] ?? {}
      return {
        selector: `edge[type="${type}"]`,
        style: {
          'line-color': EDGE_COLORS[type],
          'target-arrow-color': EDGE_COLORS[type],
          ...extras,
        } satisfies cytoscape.Css.Edge,
      }
    }),

    // 置信度样式 — inferred 边用虚线
    {
      selector: 'edge[confidence="inferred"]',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [6, 3],
        'opacity': 0.6,
      } satisfies cytoscape.Css.Edge,
    },

    // 选中状态
    {
      selector: 'node.selected',
      style: {
        'border-width': 3,
        'border-color': '#3b82f6',
        'background-color': '#1d4ed8',
        'font-weight': 'bold',
      } satisfies cytoscape.Css.Node,
    },

    // 高亮状态
    {
      selector: '.highlighted',
      style: {
        'opacity': 1,
      } satisfies cytoscape.Css.Node,
    },

    // 非高亮状态（淡化）
    {
      selector: 'node:active',
      style: {
        'overlay-opacity': 0.1,
      } satisfies cytoscape.Css.Node,
    },

    // 链路追踪 — 当前站点光点
    {
      selector: 'node.trace-active',
      style: {
        'border-width': 5,
        'border-color': '#fbbf24',
        'background-color': '#b45309',
        'font-weight': 'bold',
        'z-index': 9999,
      } satisfies cytoscape.Css.Node,
    },

    // 链路追踪 — 已点亮的链路边
    {
      selector: 'edge.trace-path',
      style: {
        'line-color': '#fbbf24',
        'target-arrow-color': '#fbbf24',
        'width': 3,
        'opacity': 1,
        'z-index': 9998,
      } satisfies cytoscape.Css.Edge,
    },

    // 链路追踪 — 链路上的节点(暗黄描边)
    {
      selector: 'node.trace-path',
      style: {
        'border-width': 3,
        'border-color': '#f59e0b',
        'opacity': 1,
      } satisfies cytoscape.Css.Node,
    },
  ]
}
