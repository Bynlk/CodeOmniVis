import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CanvasToolbar } from '../../src/components/Workbench/CanvasToolbar'

describe('CanvasToolbar', () => {
  it('offers progressive disclosure controls for architecture view', () => {
    const html = renderToStaticMarkup(
      <CanvasToolbar view="architecture" depth="overview" focusAvailable={false} onDepthChange={() => {}} onFit={() => {}} />,
    )
    expect(html).toContain('Overview')
    expect(html).toContain('Full graph')
    expect(html).toContain('Focus')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('disabled=""')
  })

  it('enables focus after a node is selected', () => {
    const html = renderToStaticMarkup(
      <CanvasToolbar view="architecture" depth="full" focusAvailable onDepthChange={() => {}} onFit={() => {}} />,
    )
    expect(html).not.toContain('disabled=""')
  })

  it('keeps fit control but hides architecture depth on other views', () => {
    const html = renderToStaticMarkup(
      <CanvasToolbar view="data" depth="full" focusAvailable={false} onDepthChange={() => {}} onFit={() => {}} />,
    )
    expect(html).not.toContain('Overview')
    expect(html).toContain('Fit view')
  })
})
