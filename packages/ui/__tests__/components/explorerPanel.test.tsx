import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExplorerPanel } from '../../src/components/Workbench/ExplorerPanel'

describe('ExplorerPanel empty state', () => {
  it('uses data-specific guidance in the data view', () => {
    const html = renderToStaticMarkup(
      <ExplorerPanel graph={{ nodes: [], edges: [] }} view="data" selectedNodeId={null} onNodeSelect={() => {}} />,
    )
    expect(html).toContain('No data nodes detected')
    expect(html).not.toContain('Change the detail level')
  })

  it('does not report zero request nodes before the first analysis', () => {
    const html = renderToStaticMarkup(
      <ExplorerPanel graph={{ nodes: [], edges: [] }} view="requests" isAnalyzed={false} selectedNodeId={null} onNodeSelect={() => {}} />,
    )
    expect(html).toContain('Run the first analysis to populate this workspace')
    expect(html).not.toContain('No request nodes detected')
  })
})
