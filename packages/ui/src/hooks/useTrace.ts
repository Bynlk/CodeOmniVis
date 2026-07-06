/**
 * 全链路追踪数据 Hook
 *
 * 拉取 /api/graph/trace?node=<id>（经服务层）。
 */

import { useQuery } from '@tanstack/react-query'
import { getTrace } from '../services'

export function useTrace(nodeId: string | null) {
  return useQuery({
    queryKey: ['trace', nodeId],
    queryFn: () => getTrace(nodeId ?? ''),
    enabled: nodeId !== null,
  })
}
