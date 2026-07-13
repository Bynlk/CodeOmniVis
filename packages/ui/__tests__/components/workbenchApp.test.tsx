import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../../src/App'

describe('workbench App composition', () => {
  beforeAll(() => {
    vi.stubGlobal('window', { location: { host: 'localhost' } })
  })

  it('renders the workbench shell and removes the legacy AI workspace', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}><App /></QueryClientProvider>,
    )

    expect(html).toContain('data-workbench="command-bar"')
    expect(html).toContain('data-workbench="view-rail"')
    expect(html).toContain('CodeOmniVis')
    expect(html).not.toContain('AI Assistant')
    expect(html).not.toContain('role="tablist"')
  })
})
