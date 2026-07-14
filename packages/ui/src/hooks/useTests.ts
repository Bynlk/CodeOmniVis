import { useQuery } from '@tanstack/react-query'
import { getTests } from '../services'

export function useTests() {
  return useQuery({ queryKey: ['tests'], queryFn: getTests, refetchInterval: 30_000 })
}
