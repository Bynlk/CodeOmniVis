/**
 * 图解析错误 Hook（feature-001 + feature-006）
 *
 * 拉取 /api/graph/errors（经服务层），供 IssuesPanel 列表与问题 tab 徽标共用。
 * 由 WebSocket 的错误事件 invalidate（queryKey: ['graph-errors']）。
 */

import { useQuery } from '@tanstack/react-query'
import { getGraphErrors } from '../services'
import type { ParseError } from '../services'

export const GRAPH_ERRORS_QUERY_KEY: string[] = ['graph-errors']

export function useGraphErrors() {
  return useQuery({
    queryKey: GRAPH_ERRORS_QUERY_KEY,
    queryFn: getGraphErrors,
    refetchInterval: 30000, // 主要依赖 WebSocket 推送
  })
}

export type { ParseError }
