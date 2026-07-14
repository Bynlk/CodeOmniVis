import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { handleGetTestCoverage } from '../../src/tools/getTestCoverage'

describe('get_test_coverage', () => {
  const db = new OmniDatabase(':memory:')
  beforeAll(async () => {
    await db.ready()
    db.upsertNode({ id: 'test_case:a.test.ts:works', type: 'test_case', name: 'works', filePath: 'a.test.ts', line: 1, column: 1, metadata: { framework: 'jest', isParameterized: false, disabled: false } })
  })
  afterAll(() => db.close())
  it('returns the shared summary with framework filtering', () => {
    const result = handleGetTestCoverage(db, { framework: 'jest' })
    const content = result.content[0]
    if (content.type !== 'text') throw new Error('Expected text content')
    expect(JSON.parse(content.text).summary).toMatchObject({ cases: 1, byFramework: { jest: 1 } })
  })
})
