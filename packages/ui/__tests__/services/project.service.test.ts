import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProject, isAbsoluteProjectPath, postAnalyze } from '../../src/services/project'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getProject', () => {
  it('returns the active absolute project root', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { projectRoot: '/Users/dev/project' },
      meta: {},
    }), { status: 200 })))

    await expect(getProject()).resolves.toEqual({ projectRoot: '/Users/dev/project' })
    expect(fetch).toHaveBeenCalledWith('/api/project', undefined)
  })

  it('rejects a malformed project response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 })))

    await expect(getProject()).rejects.toThrow('Invalid project response')
  })
})

describe('isAbsoluteProjectPath', () => {
  it('accepts POSIX and Windows absolute project paths', () => {
    expect(isAbsoluteProjectPath('/Users/dev/project')).toBe(true)
    expect(isAbsoluteProjectPath('C:\\code\\project')).toBe(true)
  })

  it('rejects relative and empty project paths', () => {
    expect(isAbsoluteProjectPath('demo')).toBe(false)
    expect(isAbsoluteProjectPath('../demo')).toBe(false)
    expect(isAbsoluteProjectPath('')).toBe(false)
  })
})

describe('postAnalyze', () => {
  it('preserves the structured server error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'ANALYSIS_FAILED', message: 'analysis exploded' },
    }), { status: 500, statusText: 'Internal Server Error' })))

    await expect(postAnalyze()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'analysis exploded',
    })
  })
})
