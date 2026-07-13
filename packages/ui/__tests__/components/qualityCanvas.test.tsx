import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { IssueDetectorStatus } from '@codeomnivis/shared'
import { QualityCanvas } from '../../src/components/Workbench/QualityCanvas'
import type { QualityFinding } from '../../src/lib/qualityFindings'

const COMPLETE_DETECTORS: IssueDetectorStatus[] = [
  { id: 'consistency', status: 'complete' },
  { id: 'auth', status: 'complete' },
  { id: 'n_plus_one', status: 'complete' },
  { id: 'rsc', status: 'complete' },
]

function makeFinding(index: number, kind: 'auth' | 'consistency'): QualityFinding {
  const auth = kind === 'auth'
  return {
    id: `${kind}-${index}`,
    source: auth ? 'security' : 'consistency',
    severity: auth ? 'critical' : 'warning',
    type: auth ? 'unguarded_route' : 'dead_route',
    message: auth ? 'Missing authentication guard' : 'Route has no callers',
    locations: [{ file: auth ? 'app/api/demo route.ts' : 'server/router.ts', line: auth ? 4 : 8 }],
    relatedNodeIds: [],
  }
}

describe('QualityCanvas', () => {
  it('renders all project findings with source, type, severity, and source links', () => {
    const findings = [
      ...Array.from({ length: 6 }, (_, index) => makeFinding(index, 'auth')),
      ...Array.from({ length: 7 }, (_, index) => makeFinding(index, 'consistency')),
    ]
    const html = renderToStaticMarkup(
      <QualityCanvas
        findings={findings}
        isLoading={false}
        detectors={COMPLETE_DETECTORS}
        projectRoot="/Users/dev/CodeOmniVis"
      />,
    )

    expect(html).toContain('13 findings')
    expect(html).toContain('Missing authentication guard')
    expect(html).toContain('Security')
    expect(html).toContain('Unguarded route')
    expect(html).toContain('app/api/demo route.ts:4')
    expect(html).toContain('href="vscode://file/Users/dev/CodeOmniVis/app/api/demo%20route.ts:4"')
  })

  it('shows successful findings with a partial notice when one request fails', () => {
    const html = renderToStaticMarkup(
      <QualityCanvas
        findings={[makeFinding(0, 'consistency')]}
        isLoading={false}
        issuesError={new Error('503 Service Unavailable')}
        detectors={[]}
      />,
    )

    expect(html).toContain('Partial quality results')
    expect(html).toContain('Route has no callers')
    expect(html).not.toContain('No quality findings')
  })

  it('shows a partial notice when a detector fails', () => {
    const detectors: IssueDetectorStatus[] = COMPLETE_DETECTORS.map(detector => (
      detector.id === 'auth'
        ? { id: 'auth', status: 'failed', message: 'source unavailable' }
        : detector
    ))
    const html = renderToStaticMarkup(
      <QualityCanvas findings={[]} isLoading={false} detectors={detectors} />,
    )

    expect(html).toContain('Partial quality results')
    expect(html).toContain('Auth detector')
    expect(html).not.toContain('No quality findings')
  })

  it('shows unavailable when both quality requests fail', () => {
    const html = renderToStaticMarkup(
      <QualityCanvas
        findings={[]}
        isLoading={false}
        parserError={new Error('parser unavailable')}
        issuesError={new Error('issues unavailable')}
        detectors={[]}
      />,
    )

    expect(html).toContain('Quality data unavailable')
    expect(html).not.toContain('No quality findings')
  })

  it('uses a truthful empty state only after complete successful detection', () => {
    const html = renderToStaticMarkup(
      <QualityCanvas findings={[]} isLoading={false} detectors={COMPLETE_DETECTORS} />,
    )

    expect(html).toContain('No quality findings')
    expect(html).toContain('No deterministic parser or project risks were reported')
  })
})
