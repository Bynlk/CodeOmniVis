import { useQuery } from '@tanstack/react-query'
import { getGraphIssues } from '../services'

export const GRAPH_ISSUES_QUERY_KEY: string[] = ['graph-issues']

export function useGraphIssues() {
  return useQuery({
    queryKey: GRAPH_ISSUES_QUERY_KEY,
    queryFn: getGraphIssues,
  })
}
