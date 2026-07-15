import { describe, expect, it } from 'vitest'
import { isTestSourcePath } from '../../src/graph/sourcePathPolicy'

describe('isTestSourcePath', () => {
  it('keeps production source paths eligible for parser dispatch', () => {
    expect(isTestSourcePath('src/app/page.tsx')).toBe(false)
    expect(isTestSourcePath('src/contest/page.tsx')).toBe(false)
  })

  it('classifies test files and test-only directories', () => {
    expect(isTestSourcePath('src/widget.test.tsx')).toBe(true)
    expect(isTestSourcePath('src/widget.spec.ts')).toBe(true)
    expect(isTestSourcePath('src/widget.cy.tsx')).toBe(true)
    expect(isTestSourcePath('packages/a/__tests__/fixtures/app/route.ts')).toBe(true)
    expect(isTestSourcePath('e2e/workbench.spec.ts')).toBe(true)
  })

  it('normalizes Windows path separators', () => {
    expect(isTestSourcePath('packages\\a\\__tests__\\fixtures\\app\\route.ts')).toBe(true)
  })
})
