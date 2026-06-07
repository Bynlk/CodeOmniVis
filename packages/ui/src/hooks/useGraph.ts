/**
 * 图数据获取 Hook
 *
 * 使用 React Query 管理图数据的获取和缓存。
 */

import { useQuery } from '@tanstack/react-query'
import type { OmniGraph } from '@codeomnivis/shared'

// ============================================================
// API 函数
// ============================================================

interface GraphResponse {
  data: OmniGraph
  meta: {
    nodeCount: number
    edgeCount: number
    nodesByType: Record<string, number>
    edgesByType: Record<string, number>
  }
}

async function fetchGraph(): Promise<GraphResponse> {
  const response = await fetch('/api/graph')

  if (!response.ok) {
    throw new Error(`Failed to fetch graph: ${response.statusText}`)
  }

  return response.json()
}

// 深度比较函数，用于避免不必要的重渲染
function isGraphEqual(a: OmniGraph | undefined, b: OmniGraph | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.nodes.length === b.nodes.length && a.edges.length === b.edges.length
}

// ============================================================
// Hook
// ============================================================

export function useGraph() {
  return useQuery({
    queryKey: ['graph'],
    queryFn: fetchGraph,
    select: (data) => data.data,
    refetchInterval: 30000, // 改为 30 秒，主要依赖 WebSocket 推送
    structuralSharing: (oldData, newData) => {
      // 如果数据结构相同，返回旧引用避免重渲染
      if (isGraphEqual(oldData as OmniGraph, newData as OmniGraph)) {
        return oldData
      }
      return newData
    },
  })
}
