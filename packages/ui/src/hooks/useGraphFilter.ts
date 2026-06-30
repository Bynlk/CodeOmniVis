import { useState, useCallback, useRef, useEffect } from 'react'
import { useCytoscapeRef } from '../lib/cytoscapeContext'
import { NODE_TYPE_LIST } from '../lib/nodeConfig'
import { EDGE_TYPE_LIST } from '../lib/edgeConfig'
import { isEdgeType, isNodeType } from '@codeomnivis/shared'
import type { EdgeConfidence, EdgeType, NodeType } from '@codeomnivis/shared'

interface GraphFilterState {
  nodeTypeFilter: Set<NodeType>
  edgeTypeFilter: Set<EdgeType>
  confidenceFilter: Set<EdgeConfidence>
  showIsolated: boolean
}

function isEdgeConfidence(value: unknown): value is EdgeConfidence {
  return value === 'certain' || value === 'inferred'
}

// 创建默认状态的工厂函数（避免共享可变对象）
function createDefaultState(): GraphFilterState {
  return {
    nodeTypeFilter: new Set(NODE_TYPE_LIST),
    edgeTypeFilter: new Set(EDGE_TYPE_LIST),
    confidenceFilter: new Set(['certain', 'inferred']),
    showIsolated: true,
  }
}

export function useGraphFilter() {
  const [state, setState] = useState<GraphFilterState>(createDefaultState)
  const cyRef = useCytoscapeRef()

  // 保存 viewport 的 ref
  const savedViewport = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null)

  // 使用 useEffect 监听 state 变化并应用过滤
  useEffect(() => {
    const cy = cyRef?.current
    if (!cy) return

    // 保存当前视口（首次筛选时保存）
    if (!savedViewport.current) {
      savedViewport.current = { pan: cy.pan(), zoom: cy.zoom() }
    }

    const currentPan = cy.pan()
    const currentZoom = cy.zoom()

    cy.batch(() => {
      // 节点类型过滤
      cy.nodes().forEach(node => {
          const rawType: unknown = node.data('type')
          const type = typeof rawType === 'string' && isNodeType(rawType) ? rawType : undefined
        const hasEdges = node.degree() > 0
        const isIsolated = !hasEdges

          const typeVisible = type ? state.nodeTypeFilter.has(type) : false
        const isolatedVisible = state.showIsolated || !isIsolated

        node.style('display', typeVisible && isolatedVisible ? 'element' : 'none')
      })

      // 边类型 + 置信度过滤
      cy.edges().forEach(edge => {
          const rawEdgeType: unknown = edge.data('type')
          const edgeType = typeof rawEdgeType === 'string' && isEdgeType(rawEdgeType) ? rawEdgeType : undefined
          const rawConfidence: unknown = edge.data('confidence')
          const confidence = isEdgeConfidence(rawConfidence) ? rawConfidence : undefined

          const typeVisible = edgeType ? state.edgeTypeFilter.has(edgeType) : false
          const confVisible = confidence ? state.confidenceFilter.has(confidence) : false

        edge.style('display', typeVisible && confVisible ? 'element' : 'none')
      })
    })

    // 恢复视口（不 fit！）
    cy.viewport({ zoom: currentZoom, pan: currentPan })
  }, [state, cyRef]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleNodeType = useCallback((type: NodeType) => {
    setState(prev => {
      const next = { ...prev, nodeTypeFilter: new Set(prev.nodeTypeFilter) }
      if (next.nodeTypeFilter.has(type)) {
        next.nodeTypeFilter.delete(type)
      } else {
        next.nodeTypeFilter.add(type)
      }
      return next
    })
  }, [])

  const toggleEdgeType = useCallback((type: EdgeType) => {
    setState(prev => {
      const next = { ...prev, edgeTypeFilter: new Set(prev.edgeTypeFilter) }
      if (next.edgeTypeFilter.has(type)) {
        next.edgeTypeFilter.delete(type)
      } else {
        next.edgeTypeFilter.add(type)
      }
      return next
    })
  }, [])

  const toggleConfidence = useCallback((c: EdgeConfidence) => {
    setState(prev => {
      const next = { ...prev, confidenceFilter: new Set(prev.confidenceFilter) }
      if (next.confidenceFilter.has(c)) {
        next.confidenceFilter.delete(c)
      } else {
        next.confidenceFilter.add(c)
      }
      return next
    })
  }, [])

  const setShowIsolated = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showIsolated: show }))
  }, [])

  const resetFilters = useCallback(() => {
    setState(createDefaultState())
    // 重置后恢复 fit
    const cy = cyRef?.current
    if (cy) {
      cy.fit(undefined, 40)
      savedViewport.current = null
    }
  }, [cyRef])

  return {
    nodeTypeFilter: state.nodeTypeFilter,
    edgeTypeFilter: state.edgeTypeFilter,
    confidenceFilter: state.confidenceFilter,
    showIsolated: state.showIsolated,
    toggleNodeType,
    toggleEdgeType,
    toggleConfidence,
    setShowIsolated,
    resetFilters,
  }
}
