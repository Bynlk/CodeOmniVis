/**
 * Cytoscape.js 配置
 *
 * 定义节点和边的样式，用于 ER 图可视化。
 * 节点 label 带 Emoji 前缀，inferred 边用虚线。
 */

import type { NodeType } from '@codeomnivis/shared'
import { NODE_EMOJI, NODE_COLORS, NODE_TYPE_LIST } from '../lib/nodeConfig'

const NODE_TYPES = new Set<string>(NODE_TYPE_LIST)

function isNodeType(value: string): value is NodeType {
  return NODE_TYPES.has(value)
}

function getNodeType(node: cytoscape.NodeSingular): NodeType | undefined {
  const type = node.data('type')
  return typeof type === 'string' && isNodeType(type) ? type : undefined
}

function getNodeLabel(node: cytoscape.NodeSingular): string | undefined {
  const label = node.data('label')
  return typeof label === 'string' ? label : undefined
}

/**
 * 获取 Cytoscape 样式配置
 *
 * 使用 `satisfies` 保留 Cytoscape 样式检查，同时避免把整个样式块断言掉。
 */
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

    // 边类型样式
    {
      selector: 'edge[type="db_relation"]',
      style: {
        'line-color': '#ec4899',
        'target-arrow-color': '#ec4899',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="renders"]',
      style: {
        'line-color': '#06b6d4',
        'target-arrow-color': '#06b6d4',
        'width': 1.5,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="calls_api"]',
      style: {
        'line-color': '#10b981',
        'target-arrow-color': '#10b981',
        'width': 2,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="handles"]',
      style: {
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="calls_service"]',
      style: {
        'line-color': '#ef4444',
        'target-arrow-color': '#ef4444',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="queries_db"]',
      style: {
        'line-color': '#ec4899',
        'target-arrow-color': '#ec4899',
        'width': 2,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="kotlin_inherits"]',
      style: {
        'line-color': '#a855f7',
        'target-arrow-color': '#a855f7',
        'line-style': 'dashed',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="kotlin_implements"]',
      style: {
        'line-color': '#3b82f6',
        'target-arrow-color': '#3b82f6',
        'line-style': 'dashed',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="kotlin_uses"]',
      style: {
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'opacity': 0.5,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="sends_msg"]',
      style: {
        'line-color': '#f97316',
        'target-arrow-color': '#f97316',
        'line-style': 'dashed',
        'width': 2,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="listens_msg"]',
      style: {
        'line-color': '#14b8a6',
        'target-arrow-color': '#14b8a6',
        'line-style': 'dashed',
        'width': 2,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="navigates_to"]',
      style: {
        'line-color': '#8b5cf6',
        'target-arrow-color': '#8b5cf6',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="contains"]',
      style: {
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'line-style': 'dotted',
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="data_flows_to"]',
      style: {
        'line-color': '#06b6d4',
        'target-arrow-color': '#06b6d4',
        'width': 2,
      } satisfies cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="imports"]',
      style: {
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'opacity': 0.3,
      } satisfies cytoscape.Css.Edge,
    },

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
  ]
}
