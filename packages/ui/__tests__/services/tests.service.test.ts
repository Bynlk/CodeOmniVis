import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTests } from '../../src/services/tests'

function respond(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
    })),
  )
}

const suite = {
  id: 'suite',
  type: 'test_suite',
  name: 'suite',
  filePath: 'a.test.ts',
  line: 1,
  column: 1,
  metadata: { framework: 'vitest', kind: 'describe' },
}
const testCase = {
  id: 'case',
  type: 'test_case',
  name: 'suite > works',
  filePath: 'a.test.ts',
  line: 2,
  column: 1,
  metadata: { framework: 'vitest', isParameterized: false, disabled: false },
}
const fixture = {
  id: 'fixture',
  type: 'test_fixture',
  name: 'beforeEach',
  filePath: 'a.test.ts',
  line: 1,
  column: 1,
  metadata: { framework: 'vitest', lifecycle: 'before_each' },
}
const covers = {
  id: 'covers',
  source: 'case',
  target: 'service',
  type: 'covers',
  confidence: 'certain',
  metadata: { evidence: 'direct_call' },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('tests service', () => {
  it('validates and returns the shared test projection', async () => {
    respond({
      data: {
        suites: [suite],
        cases: [testCase],
        fixtures: [fixture],
        coverage: [covers],
        summary: {
          suites: 1,
          cases: 1,
          fixtures: 1,
          coveredTargets: 1,
          uncoveredTargets: 2,
          byFramework: { vitest: 1, invalid: 'one' },
        },
      },
    })

    await expect(getTests()).resolves.toEqual({
      suites: [suite],
      cases: [testCase],
      fixtures: [fixture],
      coverage: [covers],
      summary: {
        suites: 1,
        cases: 1,
        fixtures: 1,
        coveredTargets: 1,
        uncoveredTargets: 2,
        byFramework: { vitest: 1 },
      },
    })
    expect(fetch).toHaveBeenCalledWith('/api/tests', undefined)
  })

  it('uses safe zero defaults for malformed summary counters', async () => {
    respond({
      data: {
        suites: [],
        cases: [],
        fixtures: [],
        coverage: [],
        summary: { suites: '1', cases: null, fixtures: {}, byFramework: [] },
      },
    })

    await expect(getTests()).resolves.toMatchObject({
      summary: {
        suites: 0,
        cases: 0,
        fixtures: 0,
        coveredTargets: 0,
        uncoveredTargets: 0,
        byFramework: {},
      },
    })
  })

  it.each([
    null,
    { data: null },
    { data: { summary: null } },
    { data: { summary: {}, suites: {}, cases: [], fixtures: [], coverage: [] } },
    {
      data: {
        summary: {},
        suites: [{ ...suite, type: 'unknown' }],
        cases: [],
        fixtures: [],
        coverage: [],
      },
    },
    {
      data: {
        summary: {},
        suites: [],
        cases: [{ ...testCase, line: '2' }],
        fixtures: [],
        coverage: [],
      },
    },
    {
      data: {
        summary: {},
        suites: [],
        cases: [],
        fixtures: [],
        coverage: [{ ...covers, confidence: 'guess' }],
      },
    },
  ])('rejects malformed projection %#', async (body) => {
    respond(body)
    await expect(getTests()).rejects.toThrow('Invalid tests response')
  })
})
