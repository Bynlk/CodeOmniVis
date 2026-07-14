import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  lineCoverage,
  hasRuntimeCode,
  validateChangedCoverage,
  validateGlobalCoverage,
  validatePackageLineCoverage,
} from './verifyChangedCoverage.mjs'

test('hasRuntimeCode skips erased TypeScript contracts but keeps executable modules', () => {
  assert.equal(
    hasRuntimeCode('export interface Shape { id: string }\nexport type Id = string'),
    false,
  )
  assert.equal(hasRuntimeCode("import type { Shape } from './types'\nexport type { Shape }"), false)
  assert.equal(hasRuntimeCode('export const value = 1'), true)
  assert.equal(hasRuntimeCode("export * from './runtime'"), true)
})

test('lineCoverage counts a source line once and keeps its strongest hit count', () => {
  const result = lineCoverage({
    statementMap: {
      0: { start: { line: 1 }, end: { line: 1 } },
      1: { start: { line: 1 }, end: { line: 1 } },
      2: { start: { line: 2 }, end: { line: 2 } },
    },
    s: { 0: 0, 1: 2, 2: 0 },
  })

  assert.deepEqual(result, { covered: 1, total: 2, pct: 50 })
})

test('coverage validators report global deficits, missing files, and changed files below 90%', () => {
  const summary = {
    total: {
      lines: { pct: 84 },
      statements: { pct: 86 },
      functions: { pct: 83 },
      branches: { pct: 79 },
    },
  }
  const coverage = {
    '/repo/packages/shared/src/covered.ts': {
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
        1: { start: { line: 2 }, end: { line: 2 } },
      },
      s: { 0: 1, 1: 0 },
    },
  }

  assert.deepEqual(validateGlobalCoverage(summary), [
    'global lines 84.00% is below 85%',
    'global functions 83.00% is below 85%',
    'global branches 79.00% is below 80%',
  ])
  assert.deepEqual(
    validateChangedCoverage(
      coverage,
      ['packages/shared/src/covered.ts', 'packages/shared/src/missing.ts'],
      '/repo',
    ),
    [
      'packages/shared/src/covered.ts line coverage 50.00% is below 90%',
      'packages/shared/src/missing.ts is absent from coverage/coverage-final.json',
    ],
  )
})

test('package line coverage aggregates every source file without changing the global set', () => {
  const coverage = {
    '/repo/packages/analyzer/src/covered.ts': {
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
        1: { start: { line: 2 }, end: { line: 2 } },
      },
      s: { 0: 1, 1: 1 },
    },
    '/repo/packages/analyzer/src/uncovered.ts': {
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
      },
      s: { 0: 0 },
    },
    '/repo/packages/ui/src/ignored.ts': {
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
      },
      s: { 0: 0 },
    },
  }

  assert.deepEqual(validatePackageLineCoverage(coverage, '/repo', 'analyzer', 85), [
    'analyzer lines 66.67% is below 85%',
  ])
})
