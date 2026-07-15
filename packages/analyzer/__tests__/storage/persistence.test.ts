import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openedFlags } = vi.hoisted(() => ({ openedFlags: [] as string[] }))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    openSync: (...args: Parameters<typeof actual.openSync>) => {
      openedFlags.push(String(args[1]))
      return actual.openSync(...args)
    },
  }
})

import { persistDatabaseAtomically } from '../../src/storage/persistence'

describe('atomic database persistence', () => {
  beforeEach(() => {
    openedFlags.length = 0
  })

  it('opens the temporary snapshot writable before fsync for Windows compatibility', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-persistence-'))
    const target = path.join(root, 'graph.db')

    try {
      persistDatabaseAtomically(target, Uint8Array.from([1, 2, 3]))

      expect(openedFlags).toContain('r+')
      expect(fs.readFileSync(target)).toEqual(Buffer.from([1, 2, 3]))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
