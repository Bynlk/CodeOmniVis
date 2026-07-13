import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveProjectRootRequest } from '../src/projectRootPolicy'

const roots: string[] = []

function makeRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('resolveProjectRootRequest', () => {
  it('allows an unrelated existing absolute root in local trust mode', () => {
    const startupRoot = makeRoot('covis-startup-')
    const siblingRoot = makeRoot('covis-sibling-')

    expect(resolveProjectRootRequest(startupRoot, siblingRoot, true)).toEqual({
      ok: true,
      resolved: path.resolve(siblingRoot),
    })
  })

  it('rejects an unrelated absolute root in bounded mode', () => {
    const startupRoot = makeRoot('covis-startup-')
    const siblingRoot = makeRoot('covis-sibling-')

    expect(resolveProjectRootRequest(startupRoot, siblingRoot, false)).toEqual({
      ok: false,
      resolved: path.resolve(siblingRoot),
    })
  })

  it('keeps relative paths inside the startup boundary in every mode', () => {
    const startupRoot = makeRoot('covis-startup-')
    const child = path.join(startupRoot, 'packages', 'app')
    fs.mkdirSync(child, { recursive: true })

    expect(resolveProjectRootRequest(startupRoot, 'packages/app', true)).toEqual({
      ok: true,
      resolved: path.resolve(child),
    })
    expect(resolveProjectRootRequest(startupRoot, '../outside', true).ok).toBe(false)
  })
})
