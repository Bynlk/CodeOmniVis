import { useState, useCallback, useRef } from 'react'
import { useCytoscapeInstance } from '../lib/cytoscapeContext'
import { NODE_TYPE_LIST } from '../lib/nodeConfig'
import { EDGE_TYPE_LIST } from '../lib/edgeConfig'
import type { NodeType } from '@omnivis/shared'
import type { EdgeType } from '@omnivis/shared'

interface GraphFilterState {
  nodeTypeFilter: Set<NodeType>
  edgeTypeFilter: Set<EdgeType>
  confidenceFilter: Set<'certain' | 'inferred'>
  showIsolated: boolean
}

// 默认全开
const DEFAULT_STATE: GraphFilterState = {
  nodeTypeFilter: new Set(NODE_TYPE_LIST),
  edgeTypeFilter: new Set(EDGE_TYPE_LIST),
  confidenceFilter: new Set(['certain', 'inferred']),
  showIsolated: true,
}

export function useGraphFilter() {
  const [state, setState] = useState<GraphFilterState>(DEFAULT_STATE)
  const cy = useCytoscapeInstance()

  // 保存 viewport 的 ref
  const savedViewport = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null)

  const applyFilter = useCallback((newState: GraphFilterState) => {
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
        const type = node.data('type') as NodeType
        const hasEdges = node.degree() > 0
        const isIsolated = !hasEdges

        const typeVisible = newState.nodeTypeFilter.has(type)
        const isolatedVisible = newState.showIsolated || !isIsolated

        node.style('display', typeVisible && isolatedVisible ? 'element' : 'none')
      })

      // 边类型 + 置信度过滤
      cy.edges().forEach(edge => {
        const edgeType = edge.data('type') as EdgeType
        const confidence = edge.data('confidence') as 'certain' | 'inferred'

        const typeVisible = newState.edgeTypeFilter.has(edgeType)
        const confVisible = newState.confidenceFilter.has(confidence)

        edge.style('display', typeVisible && confVisible ? 'element' : 'none')
      })
    })

    // 恢复视口（不 fit！）
    cy.viewport({ zoom: currentZoom, pan: currentPan })
  }, [cy])

  const toggleNodeType = useCallback((type: NodeType) => {
    setState(prev => {
      const next = { ...prev, nodeTypeFilter: new Set(prev.nodeTypeFilter) }
      if (next.nodeTypeFilter.has(type)) {
        next.nodeTypeFilter.delete(type)
      } else {
        next.nodeTypeFilter.add(type)
      }
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const toggleEdgeType = useCallback((type: EdgeType) => {
    setState(prev => {
      const next = { ...prev, edgeTypeFilter: new Set(prev.edgeTypeFilter) }
      if (next.edgeTypeFilter.has(type)) {
        next.edgeTypeFilter.delete(type)
      } else {
        next.edgeTypeFilter.add(type)
      }
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const toggleConfidence = useCallback((c: 'certain' | 'inferred') => {
    setState(prev => {
      const next = { ...prev, confidenceFilter: new Set(prev.confidenceFilter) }
      if (next.confidenceFilter.has(c)) {
        next.confidenceFilter.delete(c)
      } else {
        next.confidenceFilter.add(c)
      }
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const setShowIsolated = useCallback((show: boolean) => {
    setState(prev => {
      const next = { ...prev, showIsolated: show }
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const resetFilters = useCallback(() => {
    setState(DEFAULT_STATE)
    applyFilter(DEFAULT_STATE)
    // 重置后恢复 fit
    if (cy) {
      cy.fit(undefined, 40)
      savedViewport.current = null
    }
  }, [applyFilter, cy])

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
