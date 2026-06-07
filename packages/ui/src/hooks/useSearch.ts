import { useState, useMemo } from 'react'
import type { OmniGraph, OmniNode } from '@codeomnivis/shared'

interface UseSearchOptions {
  graph?: OmniGraph
}

interface UseSearchResult {
  query: string
  setQuery: (query: string) => void
  searchFilteredNodes: OmniNode[]  // 仅按搜索词过滤的节点
}

export function useSearch({ graph }: UseSearchOptions): UseSearchResult {
  const [query, setQuery] = useState('')

  // 按搜索词过滤节点
  const searchFilteredNodes = useMemo(() => {
    if (!graph) return []
    if (!query.trim()) return graph.nodes

    const lowerQuery = query.toLowerCase()
    return graph.nodes.filter(n =>
      n.name.toLowerCase().includes(lowerQuery) ||
      n.filePath.toLowerCase().includes(lowerQuery)
    )
  }, [graph, query])

  return {
    query,
    setQuery,
    searchFilteredNodes,
  }
}
