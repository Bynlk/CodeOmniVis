/**
 * 图数据获取 Hook
 *
 * 使用 React Query 管理图数据的获取和缓存。
 * 数据请求经由统一服务层（services/graph），不在此散落 fetch。
 */

import { useQuery } from '@tanstack/react-query'
import { getGraph } from '../services'

export function useGraph() {
  return useQuery({
    queryKey: ['graph'],
    queryFn: () => getGraph(),
    select: (data) => data.data,
    refetchInterval: 30000, // 主要依赖 WebSocket 推送
  })
}
