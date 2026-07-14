import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectSnapshot } from '@codeomnivis/shared'
import { importJunitXml } from '../../src/tests/junitXml'

const results = path.resolve(__dirname, '../fixtures/tests/results')
const snapshot: Pick<ProjectSnapshot, 'graph'> = {
  graph: {
    nodes: [
      {
        id: 'test_case:CheckoutTest:accepts valid card',
        type: 'test_case',
        name: 'CheckoutTest > accepts valid card',
        filePath: 'CheckoutTest.kt',
        line: 1,
        column: 1,
        metadata: { framework: 'junit5', isParameterized: false, disabled: false },
      },
    ],
    edges: [],
  },
}

describe('JUnit XML import', () => {
  it('normalizes passed, failed and skipped cases without fabricating nodes', () => {
    const imported = importJunitXml(path.join(results, 'junit.xml'), snapshot)
    expect(imported.cases.map((result) => result.status)).toEqual(['passed', 'failed', 'skipped'])
    expect(imported.unmatched).toHaveLength(2)
    expect(imported.cases[1].failureMessage).toBe('expected decline')
  })

  it('rejects XML entity declarations before parsing', () => {
    expect(() => importJunitXml(path.join(results, 'entity.xml'), snapshot)).toThrow(
      'entity declarations',
    )
  })
})
