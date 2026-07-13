import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CanvasEmptyState } from '../../src/components/Workbench/CanvasEmptyState'

describe('CanvasEmptyState', () => {
  it('explains missing data relationships in the data view', () => {
    const html = renderToStaticMarkup(<CanvasEmptyState view="data" hasSearchQuery={false} />)
    expect(html).toContain('No data relationships detected')
    expect(html).toContain('Prisma, TypeORM, or query relationships')
  })

  it('distinguishes a project that has not been analyzed from a valid empty result', () => {
    const html = renderToStaticMarkup(
      <CanvasEmptyState view="architecture" hasSearchQuery={false} isAnalyzed={false} />,
    )
    expect(html).toContain('Project not analyzed yet')
    expect(html).not.toContain('No architecture nodes detected')
  })

  it('prioritizes clearing search when a filter is active', () => {
    const html = renderToStaticMarkup(<CanvasEmptyState view="requests" hasSearchQuery />)
    expect(html).toContain('No nodes match this search')
    expect(html).toContain('Clear the search')
  })
})
