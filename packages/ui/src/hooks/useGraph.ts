/**
 * 图数据获取 Hook
 *
 * 使用 React Query 管理图数据的获取和缓存。
 */

import { useQuery } from '@tanstack/react-query'
import type { OmniGraph } from '@codeomnivis/shared'
import { isJsonObject } from '@codeomnivis/shared'

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

function isGraphResponse(value: unknown): value is GraphResponse {
  return isJsonObject(value) && isJsonObject(value.data) && isJsonObject(value.meta)
}

async function fetchGraph(): Promise<GraphResponse> {
  const response = await fetch('/api/graph')

  if (!response.ok) {
    throw new Error(`Failed to fetch graph: ${response.statusText}`)
  }

  const json: unknown = await response.json()
  if (!isGraphResponse(json)) {
    throw new Error('Invalid graph response')
  }
  return json
}

// ============================================================
// Hook
// ============================================================

export function useGraph() {
  return useQuery({
    queryKey: ['graph'],
    queryFn: fetchGraph,
    select: (data) => data.data,
    refetchInterval: 30000, // 主要依赖 WebSocket 推送
  })
}
