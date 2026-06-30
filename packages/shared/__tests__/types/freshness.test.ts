/**
 * 数据新鲜度契约 guard 测试。
 */

import { describe, it, expect } from 'vitest'
import {
  isFreshnessState,
  isFreshnessStatus,
  type FreshnessStatus,
} from '../../src/types/freshness'

describe('isFreshnessState', () => {
  it('accepts the three valid states', () => {
    expect(isFreshnessState('fresh')).toBe(true)
    expect(isFreshnessState('analyzing')).toBe(true)
    expect(isFreshnessState('stale')).toBe(true)
  })

  it('rejects unknown / non-string values', () => {
    expect(isFreshnessState('done')).toBe(false)
    expect(isFreshnessState('')).toBe(false)
    expect(isFreshnessState(1)).toBe(false)
    expect(isFreshnessState(null)).toBe(false)
    expect(isFreshnessState(undefined)).toBe(false)
  })
})

describe('isFreshnessStatus', () => {
  it('accepts a well-formed status with numeric lastAnalyzedAt', () => {
    const status: FreshnessStatus = { state: 'fresh', lastAnalyzedAt: 1234, pendingChanges: 0 }
    expect(isFreshnessStatus(status)).toBe(true)
  })

  it('accepts null lastAnalyzedAt', () => {
    expect(isFreshnessStatus({ state: 'stale', lastAnalyzedAt: null, pendingChanges: 3 })).toBe(true)
  })

  it('rejects invalid state', () => {
    expect(isFreshnessStatus({ state: 'nope', lastAnalyzedAt: null, pendingChanges: 0 })).toBe(false)
  })

  it('rejects wrong field types', () => {
    expect(isFreshnessStatus({ state: 'fresh', lastAnalyzedAt: '1', pendingChanges: 0 })).toBe(false)
    expect(isFreshnessStatus({ state: 'fresh', lastAnalyzedAt: 1, pendingChanges: '0' })).toBe(false)
  })

  it('rejects non-objects and arrays', () => {
    expect(isFreshnessStatus(null)).toBe(false)
    expect(isFreshnessStatus('fresh')).toBe(false)
    expect(isFreshnessStatus([])).toBe(false)
  })
})
