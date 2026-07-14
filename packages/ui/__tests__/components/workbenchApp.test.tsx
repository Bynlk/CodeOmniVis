import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App, { handleWorkbenchShortcut } from '../../src/App'
import { __resetUiStore, getUiState } from '../../src/store/uiStore'
import type { WorkbenchView } from '../../src/types/workbench'

beforeEach(() => __resetUiStore())

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

  it('renders the populated test workspace from the shared graph snapshot', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const graph = {
      nodes: [
        { id: 'suite', type: 'test_suite', name: 'orders', filePath: 'orders.test.ts', line: 1, column: 1, metadata: { framework: 'vitest', kind: 'describe' } },
        { id: 'case', type: 'test_case', name: 'orders > works', filePath: 'orders.test.ts', line: 2, column: 1, metadata: { framework: 'vitest', isParameterized: false, disabled: false } },
        { id: 'service', type: 'service', name: 'OrdersService', filePath: 'orders.ts', line: 1, column: 1, metadata: { className: 'OrdersService', methodName: 'list' } },
      ],
      edges: [
        { id: 'tests', source: 'suite', target: 'case', type: 'tests', confidence: 'certain', metadata: { relation: 'contains_case' } },
        { id: 'covers', source: 'case', target: 'service', type: 'covers', confidence: 'certain', metadata: { evidence: 'direct_call' } },
      ],
    }
    client.setQueryData(['graph'], { data: graph, meta: { nodeCount: 3, edgeCount: 2, nodesByType: {}, edgesByType: {} } })
    client.setQueryData(['graph-errors'], [])
    client.setQueryData(['graph-issues'], { issues: [], detectors: [], summary: { total: 0, critical: 0, warning: 0, info: 0 } })
    client.setQueryData(['status'], { state: 'fresh', lastAnalyzedAt: 1, pendingChanges: 0 })
    client.setQueryData(['project'], { projectRoot: '/project' })
    getUiState().setActiveView('tests')

    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}><App /></QueryClientProvider>,
    )
    expect(html).toContain('data-testid="test-explorer"')
    expect(html).toContain('orders')
    expect(html).toContain('1 cases')
    expect(html).toContain('1 targets')
  })

  it('renders both quality surfaces from the same findings snapshot', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['graph'], { data: { nodes: [], edges: [] }, meta: { nodeCount: 0, edgeCount: 0, nodesByType: {}, edgesByType: {} } })
    client.setQueryData(['graph-errors'], [{ file: 'broken.ts', message: 'parse failed', severity: 'warning' }])
    client.setQueryData(['graph-issues'], { issues: [], detectors: [], summary: { total: 0, critical: 0, warning: 0, info: 0 } })
    client.setQueryData(['status'], { state: 'fresh', lastAnalyzedAt: 1, pendingChanges: 0 })
    client.setQueryData(['project'], { projectRoot: '/project' })
    getUiState().setActiveView('quality')
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}><App /></QueryClientProvider>,
    )
    expect(html).toContain('aria-label="Quality"')
    expect(html).toContain('parse failed')
  })

  it('maps keyboard shortcuts to the command palette and five workbench views', () => {
    const views: string[] = []
    let paletteToggles = 0
    let prevented = 0
    const actions = {
      setActiveView: (view: WorkbenchView) => views.push(view),
      toggleCommandPalette: () => { paletteToggles += 1 },
    }
    handleWorkbenchShortcut(
      { metaKey: true, ctrlKey: false, key: 'k', preventDefault: () => { prevented += 1 } },
      actions,
    )
    handleWorkbenchShortcut(
      { metaKey: false, ctrlKey: true, key: '4', preventDefault: () => { prevented += 1 } },
      actions,
    )
    expect(paletteToggles).toBe(1)
    expect(views).toEqual(['tests'])
    expect(prevented).toBe(2)
  })
})
