import { describe, expect, it } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { prepareAnalysisDb } from '../../src/utils/prepareAnalysisDb'

describe('prepareAnalysisDb', () => {
  it('clears a cached graph before a new initial CLI analysis', async () => {
    const db = new OmniDatabase(':memory:')
    await db.ready()
    db.upsertNode({
      id: 'page:app/page.tsx:/page.tsx', type: 'page', name: '/page.tsx', filePath: 'app/page.tsx',
      line: 1, column: 1, metadata: { route: '/page.tsx', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
    })

    prepareAnalysisDb(db)

    expect(db.getAllNodes()).toEqual([])
  })
})
