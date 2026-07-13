import { useQuery } from '@tanstack/react-query'
import { getProject } from '../services'

export const PROJECT_QUERY_KEY = ['project'] as const

export function useProject() {
  return useQuery({
    queryKey: PROJECT_QUERY_KEY,
    queryFn: getProject,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
