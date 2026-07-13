import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { QualityFinding } from '../../src/lib/qualityFindings'
import { QualityExplorer } from '../../src/components/Workbench/QualityExplorer'

function findings(count: number, source: 'security' | 'consistency', severity: 'critical' | 'warning'): QualityFinding[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${source}-${index}`,
    source,
    severity,
    type: source === 'security' ? 'unguarded_route' : 'dead_route',
    message: 'Finding',
    locations: [{ file: 'demo.ts', line: index + 1 }],
    relatedNodeIds: [],
  }))
}

describe('QualityExplorer', () => {
  it('summarizes the unified findings by severity and source', () => {
    const html = renderToStaticMarkup(
      <QualityExplorer
        findings={[
          ...findings(6, 'security', 'critical'),
          ...findings(7, 'consistency', 'warning'),
        ]}
      />,
    )

    expect(html.match(/>6<\/span>/g) ?? []).toHaveLength(2)
    expect(html.match(/>7<\/span>/g) ?? []).toHaveLength(2)
    expect(html).not.toContain('6 critical')
    expect(html).not.toContain('7 warning')
    expect(html).not.toContain('6 Security')
    expect(html).not.toContain('7 Consistency')
  })

  it('shows partial instead of a healthy zero when one request fails', () => {
    const html = renderToStaticMarkup(
      <QualityExplorer findings={[]} issuesError={new Error('503 Service Unavailable')} />,
    )

    expect(html).toContain('Partial quality results')
    expect(html).not.toContain('No quality findings')
  })

  it('marks visible parser findings as partial while project risks are still loading', () => {
    const html = renderToStaticMarkup(
      <QualityExplorer
        findings={findings(1, 'consistency', 'warning')}
        isLoading
      />,
    )

    expect(html).toContain('Partial quality results')
    expect(html).toContain('warning')
  })

  it('shows unavailable when both requests fail', () => {
    const html = renderToStaticMarkup(
      <QualityExplorer
        findings={[]}
        parserError={new Error('parser unavailable')}
        issuesError={new Error('issues unavailable')}
      />,
    )

    expect(html).toContain('Quality data unavailable')
    expect(html).not.toContain('0 critical')
  })
})
