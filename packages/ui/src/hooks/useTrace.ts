/**
 * 全链路追踪数据 Hook
 *
 * 拉取 /api/graph/trace?node=<id>,边界处用 isTraceResult 收敛。
 */

import { useQuery } from '@tanstack/react-query'
import type { TraceResult } from '@codeomnivis/shared'
import { isJsonObject, isTraceResult } from '@codeomnivis/shared'

async function fetchTrace(nodeId: string): Promise<TraceResult> {
  const res = await fetch(`/api/graph/trace?node=${encodeURIComponent(nodeId)}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch trace: ${res.statusText}`)
  }
  const json: unknown = await res.json()
  const data = isJsonObject(json) ? json.data : undefined
  if (!isTraceResult(data)) {
    throw new Error('Invalid trace response')
  }
  return data
}

export function useTrace(nodeId: string | null) {
  return useQuery({
    queryKey: ['trace', nodeId],
    queryFn: () => fetchTrace(nodeId ?? ''),
    enabled: nodeId !== null,
  })
}
