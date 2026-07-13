import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useStatus } from '../../src/hooks/useStatus'

function StatusProbe() {
  const { data } = useStatus()
  return <span>{data.state}:{data.lastAnalyzedAt ?? 'never'}</span>
}

describe('useStatus initial state', () => {
  it('does not claim a project is fresh before status has loaded', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}><StatusProbe /></QueryClientProvider>,
    )

    expect(html).toContain('stale:never')
  })
})
