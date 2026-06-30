/**
 * 图过滤控制器(纯逻辑,非 React)。
 *
 * E-13/F15:把"按当前 filter state 隐藏/显示元素"的逻辑从 React effect 中
 * 抽离,并在 cytoscape 触发 'add' 时自动重放过滤。GraphCanvas 在 graph 刷新时
 * 会 remove/add 全部元素(新元素默认 display='element'),控制器通过监听 'add'
 * 保证刷新后过滤状态与画布保持一致。
 *
 * 通过注入式接口(FilterableCy)解耦真实 cytoscape,便于在 node 环境下单测。
 */

import { NODE_TYPE_LIST } from './nodeConfig'
import { EDGE_TYPE_LIST } from './edgeConfig'
import { isEdgeType, isNodeType } from '@codeomnivis/shared'
import type { EdgeConfidence, EdgeType, NodeType } from '@codeomnivis/shared'

export interface GraphFilterState {
  nodeTypeFilter: Set<NodeType>
  edgeTypeFilter: Set<EdgeType>
  confidenceFilter: Set<EdgeConfidence>
  showIsolated: boolean
}

export interface FilterableNode {
  data(name: string): unknown
  degree(): number
  style(name: string, value: string): void
}

export interface FilterableEdge {
  data(name: string): unknown
  style(name: string, value: string): void
}

export interface FilterableCy {
  batch(run: () => void): void
  nodes(): { forEach(cb: (node: FilterableNode) => void): void }
  edges(): { forEach(cb: (edge: FilterableEdge) => void): void }
  on(event: string, handler: () => void): void
  off(event: string, handler: () => void): void
}

function isEdgeConfidence(value: unknown): value is EdgeConfidence {
  return value === 'certain' || value === 'inferred'
}

/** 创建默认状态的工厂函数(避免共享可变对象)。 */
export function createDefaultState(): GraphFilterState {
  return {
    nodeTypeFilter: new Set(NODE_TYPE_LIST),
    edgeTypeFilter: new Set(EDGE_TYPE_LIST),
    confidenceFilter: new Set<EdgeConfidence>(['certain', 'inferred']),
    showIsolated: true,
  }
}

/** 对给定 cy 按 state 应用一次过滤(纯函数,可独立调用)。 */
export function applyFilter(cy: FilterableCy, state: GraphFilterState): void {
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      const rawType: unknown = node.data('type')
      const type = typeof rawType === 'string' && isNodeType(rawType) ? rawType : undefined
      const isIsolated = node.degree() <= 0

      const typeVisible = type ? state.nodeTypeFilter.has(type) : false
      const isolatedVisible = state.showIsolated || !isIsolated

      node.style('display', typeVisible && isolatedVisible ? 'element' : 'none')
    })

    cy.edges().forEach((edge) => {
      const rawEdgeType: unknown = edge.data('type')
      const edgeType = typeof rawEdgeType === 'string' && isEdgeType(rawEdgeType) ? rawEdgeType : undefined
      const rawConfidence: unknown = edge.data('confidence')
      const confidence = isEdgeConfidence(rawConfidence) ? rawConfidence : undefined

      const typeVisible = edgeType ? state.edgeTypeFilter.has(edgeType) : false
      const confVisible = confidence ? state.confidenceFilter.has(confidence) : false

      edge.style('display', typeVisible && confVisible ? 'element' : 'none')
    })
  })
}

/**
 * 持有 cy 与当前过滤状态,在元素新增时自动重放过滤。
 * - 构造时立即应用一次。
 * - 监听 'add' 事件:GraphCanvas 刷新 remove/add 后重放,避免新元素恢复默认可见。
 * - setState 切换过滤后立即重放。
 * - dispose 注销监听。
 */
export class GraphFilterController {
  private state: GraphFilterState
  private readonly onAdd: () => void

  constructor(
    private readonly cy: FilterableCy,
    initialState: GraphFilterState,
  ) {
    this.state = initialState
    this.onAdd = () => {
      applyFilter(this.cy, this.state)
    }
    this.cy.on('add', this.onAdd)
    applyFilter(this.cy, this.state)
  }

  setState(state: GraphFilterState): void {
    this.state = state
    applyFilter(this.cy, this.state)
  }

  dispose(): void {
    this.cy.off('add', this.onAdd)
  }
}
