import { describe, expect, it, vi } from 'vitest'
import { resolveParser } from '../../../src/parsers/kotlin/treeSitterInit'

function parserConstructor() {
  return Object.assign(function Parser() {}, { init: vi.fn(async () => {}) })
}

describe('tree-sitter parser module compatibility', () => {
  it('uses a namespace default export when the primary import is not a constructor', () => {
    const fallback = parserConstructor()
    expect(resolveParser(null, { default: fallback })).toBe(fallback)
  })

  it('uses a callable namespace for CommonJS interop', () => {
    const fallback = parserConstructor()
    expect(resolveParser(null, fallback)).toBe(fallback)
  })

  it('rejects module shapes without a parser constructor', () => {
    expect(() => resolveParser(null, {})).toThrow('Unable to load web-tree-sitter')
  })
})
