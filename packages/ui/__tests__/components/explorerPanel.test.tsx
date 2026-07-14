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

  it('groups analyzed nodes by type and marks the selected item', () => {
    const html = renderToStaticMarkup(
      <ExplorerPanel
        graph={{
          nodes: [
            { id: 'db', type: 'db_model', name: 'Order', filePath: 'schema.ts', line: 1, column: 1, metadata: { tableName: 'orders', fieldCount: 0, fields: [] } },
            { id: 'component', type: 'component', name: 'OrderCard', filePath: 'Card.tsx', line: 1, column: 1, metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 } },
          ],
          edges: [],
        }}
        view="architecture"
        selectedNodeId="db"
        onNodeSelect={() => {}}
      />,
    )
    expect(html).toContain('Order')
    expect(html).toContain('OrderCard')
    expect(html).toContain('bg-primary-500/10')
    expect(html).toContain('<ellipse')
  })

  it('uses quality-specific copy after an analyzed empty result', () => {
    const html = renderToStaticMarkup(
      <ExplorerPanel graph={{ nodes: [], edges: [] }} view="quality" isAnalyzed selectedNodeId={null} onNodeSelect={() => {}} />,
    )
    expect(html).toContain('No quality findings in the latest analysis')
  })
})
