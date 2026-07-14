import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { createTestsRouter } from '../../src/routes/tests'

describe('GET /api/tests', () => {
  const db = new OmniDatabase(':memory:')
  const app = express()
  beforeAll(async () => {
    await db.ready()
    db.upsertNode({
      id: 'test_suite:a.test.ts:suite',
      type: 'test_suite',
      name: 'suite',
      filePath: 'a.test.ts',
      line: 1,
      column: 1,
      metadata: { framework: 'vitest', kind: 'describe' },
    })
    db.upsertNode({
      id: 'test_case:a.test.ts:suite > works',
      type: 'test_case',
      name: 'suite > works',
      filePath: 'a.test.ts',
      line: 2,
      column: 1,
      metadata: { framework: 'vitest', isParameterized: false, disabled: false },
    })
    db.upsertNode({
      id: 'service:src/a.ts:work',
      type: 'service',
      name: 'work',
      filePath: 'src/a.ts',
      line: 1,
      column: 1,
      metadata: { className: null, methodName: 'work' },
    })
    db.upsertEdge({
      id: 'coverage',
      source: 'test_case:a.test.ts:suite > works',
      target: 'service:src/a.ts:work',
      type: 'covers',
      confidence: 'certain',
      metadata: { evidence: 'direct_call' },
    })
    app.use('/api/tests', createTestsRouter(db))
  })
  afterAll(() => db.close())
  it('returns test structure, coverage summary and snapshot identity fields', async () => {
    const response = await request(app).get('/api/tests?framework=vitest')
    expect(response.status).toBe(200)
    expect(response.body.data.summary).toMatchObject({ suites: 1, cases: 1, coveredTargets: 1 })
    expect(response.body.meta).toHaveProperty('snapshotDigest')
  })
})
