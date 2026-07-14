import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useTests } from '../../src/hooks/useTests'

function Probe() {
  const query = useTests()
  return <span>{query.status}</span>
}

describe('useTests', () => {
  it('registers the shared tests query without executing during SSR', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    )
    expect(html).toContain('pending')
    expect(client.getQueryCache().find({ queryKey: ['tests'] })).toBeDefined()
  })
})
