/**
 * Cytoscape.js 配置
 *
 * 定义节点和边的样式，用于 ER 图可视化。
 * 节点 label 带 Emoji 前缀，inferred 边用虚线。
 */

import type { NodeType } from '@omnivis/shared'
import { NODE_EMOJI, NODE_COLORS } from '../lib/nodeConfig'

/**
 * 获取 Cytoscape 样式配置
 *
 * 使用 `as unknown as cytoscape.Css.Node/Edge` 处理函数 mapper：
 * Cytoscape.js 允许样式值为 `(ele) => value` 函数，但 @types/cytoscape
 * 的 CSS 类型定义不支持此模式。`as unknown as` 比 `as any` 更安全，
 * 因为它强制显式转换且保留了类型意图。
 */
export function getCytoscapeStyle(): cytoscape.StylesheetJson {
  return [
    // 节点基础样式 — emoji + 文字在节点内
    {
      selector: 'node',
      style: {
        'background-color': (node: cytoscape.SingularElementReturnValue) => {
          const type = node.data('type') as NodeType
          return NODE_COLORS[type] ?? '#6b7280'
        },
        'label': (node: cytoscape.SingularElementReturnValue) => {
          const type = node.data('type') as NodeType
          const label = node.data('label') as string
          const emoji = NODE_EMOJI[type] ?? '●'
          const displayName = label && label.length > 16 ? label.slice(0, 14) + '…' : label ?? '?'
          return `${emoji} ${displayName}`
        },
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '10px',
        'font-weight': '500',
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
      } as unknown as cytoscape.Css.Node,
    },

    // 节点类型样式（保留特化样式）
    {
      selector: 'node[type="db_model"]',
      style: {
        'border-width': 2,
        'border-color': '#f472b6',
      } as unknown as cytoscape.Css.Node,
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
      } as unknown as cytoscape.Css.Edge,
    },

    // 边类型样式
    {
      selector: 'edge[type="db_relation"]',
      style: {
        'line-color': '#ec4899',
        'target-arrow-color': '#ec4899',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="renders"]',
      style: {
        'line-color': '#06b6d4',
        'target-arrow-color': '#06b6d4',
        'width': 1.5,
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="calls_api"]',
      style: {
        'line-color': '#10b981',
        'target-arrow-color': '#10b981',
        'width': 2,
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="handles"]',
      style: {
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="calls_service"]',
      style: {
        'line-color': '#ef4444',
        'target-arrow-color': '#ef4444',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="queries_db"]',
      style: {
        'line-color': '#ec4899',
        'target-arrow-color': '#ec4899',
        'width': 2,
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="kotlin_inherits"]',
      style: {
        'line-color': '#a855f7',
        'target-arrow-color': '#a855f7',
        'line-style': 'dashed',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="kotlin_implements"]',
      style: {
        'line-color': '#3b82f6',
        'target-arrow-color': '#3b82f6',
        'line-style': 'dashed',
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type="kotlin_uses"]',
      style: {
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'opacity': 0.5,
      } as unknown as cytoscape.Css.Edge,
    },

    // 置信度样式 — inferred 边用虚线
    {
      selector: 'edge[confidence="inferred"]',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [6, 3],
        'opacity': 0.6,
      } as unknown as cytoscape.Css.Edge,
    },

    // 选中状态
    {
      selector: 'node.selected',
      style: {
        'border-width': 3,
        'border-color': '#3b82f6',
        'background-color': '#1d4ed8',
        'font-weight': 'bold',
      } as unknown as cytoscape.Css.Node,
    },

    // 高亮状态
    {
      selector: '.highlighted',
      style: {
        'opacity': 1,
      } as unknown as cytoscape.Css.Node,
    },

    // 非高亮状态（淡化）
    {
      selector: 'node:active',
      style: {
        'overlay-opacity': 0.1,
      } as unknown as cytoscape.Css.Node,
    },
  ]
}
