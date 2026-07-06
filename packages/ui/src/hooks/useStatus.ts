/**
 * 数据新鲜度 Hook
 *
 * 拉取 /api/status（经服务层），并由 WebSocket 的 status_changed 推送实时更新缓存。
 */

import { useQuery } from '@tanstack/react-query'
import type { FreshnessStatus } from '@codeomnivis/shared'
import { getStatus } from '../services'

export const STATUS_QUERY_KEY: string[] = ['status']

const FALLBACK_STATUS: FreshnessStatus = {
  state: 'fresh',
  lastAnalyzedAt: null,
  pendingChanges: 0,
}

export function useStatus() {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: getStatus,
    initialData: FALLBACK_STATUS,
    // 主要依赖 WebSocket 推送;轮询作为兜底。
    refetchInterval: 15000,
  })
}
