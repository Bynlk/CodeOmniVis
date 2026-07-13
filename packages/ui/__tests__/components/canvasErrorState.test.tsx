import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CanvasErrorState } from '../../src/components/Workbench/CanvasErrorState'

describe('CanvasErrorState', () => {
  it('uses request-flow copy for request failures', () => {
    const html = renderToStaticMarkup(
      <CanvasErrorState view="requests" error={new Error('503')} />,
    )
    expect(html).toContain('Unable to load request flow')
    expect(html).not.toContain('Unable to load the architecture graph')
  })

  it('uses data-model copy for data failures', () => {
    const html = renderToStaticMarkup(
      <CanvasErrorState view="data" error={new Error('503')} />,
    )
    expect(html).toContain('Unable to load the data model')
  })
})
