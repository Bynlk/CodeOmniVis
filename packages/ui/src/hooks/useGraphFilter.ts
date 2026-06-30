import { useState, useCallback, useRef, useEffect } from 'react'
import { useCytoscapeRef } from '../lib/cytoscapeContext'
import {
  GraphFilterController,
  createDefaultState,
  type GraphFilterState,
} from '../lib/graphFilterController'
import type { EdgeConfidence, EdgeType, NodeType } from '@codeomnivis/shared'

export function useGraphFilter() {
  const [state, setState] = useState<GraphFilterState>(createDefaultState)
  const cyRef = useCytoscapeRef()
  const controllerRef = useRef<GraphFilterController | null>(null)

  // 绑定/重建控制器:cy 实例变化时重新挂载,并在卸载时注销 'add' 监听。
  // 控制器内部监听 cy 'add' 事件,GraphCanvas 刷新 remove/add 后会自动重放过滤,
  // 修复 E-13:图刷新后过滤状态丢失、新元素恢复默认可见的问题。
  useEffect(() => {
    const cy = cyRef?.current
    if (!cy) return

    const controller = new GraphFilterController(cy, state)
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
    // 仅在 cy 实例变化时重建;state 变化通过下方 effect 推送,避免反复挂卸监听。
  }, [cyRef])

  // state 变化时推送到控制器立即重放(控制器已挂载时)。
  useEffect(() => {
    controllerRef.current?.setState(state)
  }, [state])

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
  }, [])

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
