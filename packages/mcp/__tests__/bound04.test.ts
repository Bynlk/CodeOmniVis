/**
 * BOUND-04 回归:MCP depth 参数边界 + getSubtree 终止性。
 *
 * 直接调用 index.ts 导出的真实 handler(不再复制简化逻辑),
 * 覆盖 depth="Infinity"/超大值/负数/非整数 返回 MCP error,
 * 以及环形 renders 图下 get_component_tree 必须终止(不栈溢出)。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { handleGetComponentTree } from '../src/index'

function textOf(result: CallToolResult): unknown {
  const first = result.content[0]
  if (first.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
}

describe('BOUND-04 — MCP get_component_tree depth validation', () => {
  let db: OmniDatabase

  beforeEach(async () => {
    db = new OmniDatabase(':memory:')
    await db.ready()
    db.upsertNode({
      id: 'component:app/Root.tsx:Root',
      type: 'component',
      name: 'Root',
      filePath: 'app/Root.tsx',
      line: 1,
      column: 1,
      metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 1 },
    })
  })

  afterEach(() => {
    db.close()
  })

  it('rejects depth="Infinity" with an MCP error', () => {
    const res = handleGetComponentTree(db, { rootPath: 'app/Root.tsx', depth: 'Infinity' })
    expect(res.isError).toBe(true)
    const body = textOf(res)
    expect(body).toHaveProperty('error')
  })

  it('rejects an oversized depth with an MCP error', () => {
    const res = handleGetComponentTree(db, { rootPath: 'app/Root.tsx', depth: 1e9 })
    expect(res.isError).toBe(true)
  })

  it('rejects a negative depth with an MCP error', () => {
    const res = handleGetComponentTree(db, { rootPath: 'app/Root.tsx', depth: -5 })
    expect(res.isError).toBe(true)
  })

  it('rejects a non-integer depth with an MCP error', () => {
    const res = handleGetComponentTree(db, { rootPath: 'app/Root.tsx', depth: 2.5 })
    expect(res.isError).toBe(true)
  })

  it('accepts a valid integer depth', () => {
    const res = handleGetComponentTree(db, { rootPath: 'app/Root.tsx', depth: 3 })
    expect(res.isError).toBeUndefined()
  })
})

describe('BOUND-04 — getSubtree terminates on cyclic renders graph', () => {
  it('does not infinitely recurse when renders edges form a cycle', async () => {
    const db = new OmniDatabase(':memory:')
    await db.ready()
    // A renders B, B renders A —— 成环。
    for (const id of ['A', 'B']) {
      db.upsertNode({
        id: `component:app/${id}.tsx:${id}`,
        type: 'component',
        name: id,
        filePath: `app/${id}.tsx`,
        line: 1,
        column: 1,
        metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 1 },
      })
    }
    db.upsertEdge({
      id: 'r-ab',
      source: 'component:app/A.tsx:A',
      target: 'component:app/B.tsx:B',
      type: 'renders',
      confidence: 'certain',
      metadata: { jsxLine: 1 },
    })
    db.upsertEdge({
      id: 'r-ba',
      source: 'component:app/B.tsx:B',
      target: 'component:app/A.tsx:A',
      type: 'renders',
      confidence: 'certain',
      metadata: { jsxLine: 2 },
    })

    // 大 depth + 成环:无 visited 会栈溢出;有 visited 必须快速终止。
    const tree = db.getSubtree('component:app/A.tsx:A', 'renders', 100)
    expect(tree).not.toBeNull()
    if (tree === null) throw new Error('expected subtree')
    expect(tree.id).toBe('component:app/A.tsx:A')
    // A -> B,B 不再展开 A(已访问),因此 B 的 children 为空。
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0].id).toBe('component:app/B.tsx:B')
    expect(tree.children[0].children).toHaveLength(0)
    db.close()
  })

  it('clamps an out-of-range maxDepth instead of throwing', async () => {
    const db = new OmniDatabase(':memory:')
    await db.ready()
    db.upsertNode({
      id: 'component:app/Solo.tsx:Solo',
      type: 'component',
      name: 'Solo',
      filePath: 'app/Solo.tsx',
      line: 1,
      column: 1,
      metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
    })
    const tree = db.getSubtree('component:app/Solo.tsx:Solo', 'renders', Number.POSITIVE_INFINITY)
    expect(tree).not.toBeNull()
    db.close()
  })
})
