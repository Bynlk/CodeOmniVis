import { describe, expect, it } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import { validateProjectRoot } from '../../src/utils/validateProjectRoot'

describe('validateProjectRoot', () => {
  it('rejects a missing project path before the server starts', () => {
    const missing = path.join(os.tmpdir(), 'codeomnivis-missing-project')
    expect(() => validateProjectRoot(missing)).toThrow('Project root is not an existing directory')
  })

  it('returns an absolute path for an existing directory', () => {
    expect(validateProjectRoot('.')).toBe(process.cwd())
  })
})
