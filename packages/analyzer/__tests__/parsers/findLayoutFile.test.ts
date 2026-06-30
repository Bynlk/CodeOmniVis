/**
 * H5 · BOUND-02 findLayoutFile 终止性测试。
 *
 * 向上查找 layout 必须在到达仓库根 / 超出最大层数时停止,
 * 即使路径不含 `app` 段也不能挂起。注入 exists 谓词避免依赖真实文件系统。
 */

import { describe, it, expect } from 'vitest'
import { findLayoutFileBounded } from '../../src/parsers/nextjsApp'

describe('findLayoutFileBounded — termination', () => {
  it('returns within a bounded number of steps for a deep path with no layout', () => {
    let calls = 0
    const exists = (): boolean => {
      calls += 1
      return false
    }
    const deep = 'a/b/c/d/e/f/g/h/i/j/page.tsx'
    const result = findLayoutFileBounded(deep, '/repo', exists)
    expect(result).toBeNull()
    // 必须有限步终止(不挂起);层数上限远小于无界递归。
    expect(calls).toBeLessThanOrEqual(64)
  })

  it('does not hang for a path without an "app" segment', () => {
    let calls = 0
    const exists = (): boolean => {
      calls += 1
      return false
    }
    const result = findLayoutFileBounded('pages/foo/bar/page.tsx', '/repo', exists)
    expect(result).toBeNull()
    expect(calls).toBeGreaterThan(0)
    expect(calls).toBeLessThanOrEqual(64)
  })

  it('returns the nearest layout when one exists in an ancestor dir', () => {
    const exists = (full: string): boolean => full.replace(/\\/g, '/').endsWith('app/dashboard/layout.tsx')
    const result = findLayoutFileBounded('app/dashboard/users/page.tsx', '/repo', exists)
    expect(result).not.toBeNull()
    expect(result?.replace(/\\/g, '/')).toBe('app/dashboard/layout.tsx')
  })

  it('finds a layout co-located with the page', () => {
    const exists = (full: string): boolean => full.replace(/\\/g, '/').endsWith('app/settings/layout.tsx')
    const result = findLayoutFileBounded('app/settings/page.tsx', '/repo', exists)
    expect(result?.replace(/\\/g, '/')).toBe('app/settings/layout.tsx')
  })
})
