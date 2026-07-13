import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkbenchShell } from '../../src/components/Workbench/WorkbenchShell'
import { ViewRail } from '../../src/components/Workbench/ViewRail'

describe('WorkbenchShell', () => {
  it('renders command, navigation, explorer, canvas, inspector, and status regions', () => {
    const html = renderToStaticMarkup(
      <WorkbenchShell
        commandBar={<span>command</span>}
        viewRail={<span>rail</span>}
        explorer={<span>explorer</span>}
        main={<span>canvas</span>}
        inspector={<span>inspector</span>}
        statusBar={<span>status</span>}
        mobileExplorerOpen
        onCloseMobileExplorer={() => {}}
      />,
    )

    expect(html).toContain('data-workbench="command-bar"')
    expect(html).toContain('data-workbench="view-rail"')
    expect(html).toContain('data-workbench="explorer"')
    expect(html).toContain('data-workbench="canvas"')
    expect(html).toContain('data-workbench="inspector"')
    expect(html).toContain('data-workbench="status-bar"')
    expect(html).toContain('data-workbench="mobile-explorer"')
    expect(html).toContain('aria-label="Close explorer"')
    expect(html).toContain('max-md:hidden')
    expect(html).toContain('md:hidden')
    expect(html).toContain('data-workbench="mobile-explorer-backdrop"')
    expect(html).toContain('relative z-10')
    expect(html).toContain('href="#main-content"')
    expect(html).toContain('Skip to main content')
  })
})

describe('ViewRail', () => {
  it('offers four architecture views and no AI workspace destination', () => {
    const html = renderToStaticMarkup(
      <ViewRail activeView="architecture" onViewChange={() => {}} issueCount={3} />,
    )

    expect(html).toContain('Architecture')
    expect(html).toContain('Requests')
    expect(html).toContain('Data model')
    expect(html).toContain('Quality')
    expect(html).not.toContain('AI Assistant')
    expect(html).toContain('aria-current="page"')
  })
})
