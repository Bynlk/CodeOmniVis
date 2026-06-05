import { useState, useMemo } from 'react'
import type { OmniGraph, OmniNode, NodeType } from '@omnivis/shared'

interface UseSearchOptions {
  graph?: OmniGraph
}

interface UseSearchResult {
  query: string
  setQuery: (query: string) => void
  filteredNodes: OmniNode[]
  activeTypes: Set<NodeType>
  toggleType: (type: NodeType) => void
}

export function useSearch({ graph }: UseSearchOptions): UseSearchResult {
  const [query, setQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set())

  // 初始化时激活所有类型
  useMemo(() => {
    if (graph && activeTypes.size === 0) {
      const types = new Set(graph.nodes.map(n => n.type))
      setActiveTypes(types)
    }
  }, [graph])

  // 过滤节点
  const filteredNodes = useMemo(() => {
    if (!graph) return []

    let nodes = graph.nodes

    // 按类型过滤
    if (activeTypes.size > 0) {
      nodes = nodes.filter(n => activeTypes.has(n.type))
    }

    // 按搜索词过滤
    if (query.trim()) {
      const lowerQuery = query.toLowerCase()
      nodes = nodes.filter(n =>
        n.name.toLowerCase().includes(lowerQuery) ||
        n.filePath.toLowerCase().includes(lowerQuery)
      )
    }

    return nodes
  }, [graph, query, activeTypes])

  // 切换类型
  const toggleType = (type: NodeType) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return {
    query,
    setQuery,
    filteredNodes,
    activeTypes,
    toggleType,
  }
}
