export const ANALYSIS_QUERY_KEYS = [
  ['graph'],
  ['graph-stats'],
  ['graph-errors'],
  ['graph-issues'],
  ['status'],
] as const

interface QueryInvalidator {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>
}

export async function invalidateAnalysisQueries(client: QueryInvalidator): Promise<void> {
  await Promise.all(
    ANALYSIS_QUERY_KEYS.map(queryKey => client.invalidateQueries({ queryKey })),
  )
}
