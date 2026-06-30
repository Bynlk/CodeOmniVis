/**
 * 数据新鲜度 Hook
 *
 * 拉取 /api/status,并由 WebSocket 的 status_changed 推送实时更新缓存。
 */

import { useQuery } from '@tanstack/react-query'
import type { FreshnessStatus } from '@codeomnivis/shared'
import { isJsonObject, isFreshnessStatus } from '@codeomnivis/shared'

export const STATUS_QUERY_KEY: string[] = ['status']

const FALLBACK_STATUS: FreshnessStatus = {
  state: 'fresh',
  lastAnalyzedAt: null,
  pendingChanges: 0,
}

async function fetchStatus(): Promise<FreshnessStatus> {
  const response = await fetch('/api/status')
  if (!response.ok) {
    throw new Error(`Failed to fetch status: ${response.statusText}`)
  }
  const json: unknown = await response.json()
  const data = isJsonObject(json) ? json.data : undefined
  if (!isFreshnessStatus(data)) {
    throw new Error('Invalid status response')
  }
  return data
}

export function useStatus() {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: fetchStatus,
    initialData: FALLBACK_STATUS,
    // 主要依赖 WebSocket 推送;轮询作为兜底。
    refetchInterval: 15000,
  })
}
