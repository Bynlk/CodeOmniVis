/**
 * Cytoscape.js 配置
 *
 * 定义节点和边的样式，用于 ER 图可视化。
 */

import type { Stylesheet } from 'cytoscape'

/**
 * 获取 Cytoscape 样式配置
 */
export function getCytoscapeStyle(): Stylesheet[] {
  return [
    // 节点基础样式
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'font-weight': '500',
        'color': '#e2e8f0',
        'text-outline-color': '#1e293b',
        'text-outline-width': 2,
        'width': 'label',
        'height': 'label',
        'padding': '12px',
        'shape': 'roundrectangle',
        'border-radius': '6px',
      } as any,
    },

    // 节点类型样式
    {
      selector: 'node[type="page"]',
      style: {
        'shape': 'roundrectangle',
        'background-color': '#8b5cf6',
      } as any,
    },
    {
      selector: 'node[type="component"]',
      style: {
        'shape': 'roundrectangle',
        'background-color': '#06b6d4',
      } as any,
    },
    {
      selector: 'node[type="api_route"], node[type="trpc_procedure"], node[type="express_route"]',
      style: {
        'shape': 'roundrectangle',
        'background-color': '#10b981',
      } as any,
    },
    {
      selector: 'node[type="handler"]',
      style: {
        'shape': 'roundrectangle',
        'background-color': '#f59e0b',
      } as any,
    },
    {
      selector: 'node[type="service"]',
      style: {
        'shape': 'roundrectangle',
        'background-color': '#ef4444',
      } as any,
    },
    {
      selector: 'node[type="db_model"]',
      style: {
        'shape': 'roundrectangle',
        'background-color': '#ec4899',
        'border-width': 2,
        'border-color': '#f472b6',
      } as any,
    },

    // 边基础样式
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#475569',
        'target-arrow-color': '#475569',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
      } as any,
    },

    // 边类型样式
    {
      selector: 'edge[type="db_relation"]',
      style: {
        'line-color': '#ec4899',
        'target-arrow-color': '#ec4899',
        'line-style': 'dashed',
      } as any,
    },
    {
      selector: 'edge[type="renders"]',
      style: {
        'line-color': '#06b6d4',
        'target-arrow-color': '#06b6d4',
      } as any,
    },
    {
      selector: 'edge[type="calls_api"]',
      style: {
        'line-color': '#10b981',
        'target-arrow-color': '#10b981',
      } as any,
    },

    // 置信度样式
    {
      selector: 'edge[confidence="inferred"]',
      style: {
        'line-style': 'dashed',
        'opacity': 0.7,
      } as any,
    },

    // 选中状态
    {
      selector: 'node.selected',
      style: {
        'border-width': 3,
        'border-color': '#3b82f6',
        'background-color': '#1d4ed8',
        'font-weight': 'bold',
      } as any,
    },

    // 高亮状态
    {
      selector: '.highlighted',
      style: {
        'opacity': 1,
      } as any,
    },

    // 非高亮状态（淡化）
    {
      selector: 'node:active',
      style: {
        'overlay-opacity': 0.1,
      } as any,
    },
  ]
}
