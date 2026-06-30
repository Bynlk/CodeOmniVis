import { useState, useMemo } from 'react'
import type { OmniGraph, OmniNode } from '@codeomnivis/shared'
import { filterNodesByQuery } from '../lib/searchNodes'

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

  // 按搜索词过滤节点(复用纯函数 filterNodesByQuery)
  const searchFilteredNodes = useMemo(() => {
    if (!graph) return []
    return filterNodesByQuery(graph.nodes, query)
  }, [graph, query])

  return {
    query,
    setQuery,
    searchFilteredNodes,
  }
}
