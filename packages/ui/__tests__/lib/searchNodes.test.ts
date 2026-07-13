/**
 * E-12 / F16 回归测试 —— 节点搜索匹配。
 *
 * 缺陷:useSearch 计算了 searchFilteredNodes,但 App 只消费 query/setQuery,
 * Sidebar/GraphCanvas 仍接收原始 graph,搜索框输入对界面无任何影响。
 *
 * 这里把搜索匹配抽成纯函数 filterNodesByQuery 并锁定行为:
 *   1. 空 query(或仅空白)返回全部节点。
 *   2. 按 name 大小写不敏感匹配。
 *   3. 按 filePath 大小写不敏感匹配。
 *   4. 无匹配返回空数组。
 */

import { describe, it, expect } from 'vitest'
import { filterGraphByVisibleNodeIds, filterNodesByQuery, selectVisibleNodeIds } from '../../src/lib/searchNodes'
import type { OmniGraph, OmniNode } from '@codeomnivis/shared'

const nodeA: OmniNode = {
  id: 'page:app/page.tsx:/',
  type: 'page',
  name: 'HomePage',
  filePath: 'app/page.tsx',
  line: 1,
  column: 1,
  metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
}

const nodeB: OmniNode = {
  id: 'component:src/Button.tsx:Button',
  type: 'component',
  name: 'Button',
  filePath: 'src/components/Button.tsx',
  line: 5,
  column: 1,
  metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
}

const nodes = [nodeA, nodeB]

describe('filterNodesByQuery (E-12/F16)', () => {
  it('空 query 返回全部节点', () => {
    expect(filterNodesByQuery(nodes, '')).toEqual(nodes)
  })

  it('仅空白 query 返回全部节点', () => {
    expect(filterNodesByQuery(nodes, '   ')).toEqual(nodes)
  })

  it('按 name 大小写不敏感匹配', () => {
    const result = filterNodesByQuery(nodes, 'button')
    expect(result).toEqual([nodeB])
  })

  it('按 filePath 大小写不敏感匹配', () => {
    const result = filterNodesByQuery(nodes, 'APP/PAGE')
    expect(result).toEqual([nodeA])
  })

  it('无匹配返回空数组', () => {
    expect(filterNodesByQuery(nodes, 'zzz-nomatch')).toEqual([])
  })
})

describe('selectVisibleNodeIds (feature-005 统一搜索可见性 selector)', () => {
  it('空/空白 query 返回 undefined(不过滤)', () => {
    expect(selectVisibleNodeIds(nodes, '')).toBeUndefined()
    expect(selectVisibleNodeIds(nodes, '  ')).toBeUndefined()
  })

  it('nodes 未就绪返回 undefined', () => {
    expect(selectVisibleNodeIds(undefined, 'button')).toBeUndefined()
  })

  it('有匹配返回对应 id 的 Set(与 filterNodesByQuery 同源)', () => {
    const ids = selectVisibleNodeIds(nodes, 'button')
    expect(ids).toEqual(new Set([nodeB.id]))
    // 与索引函数同源:Set 内容 == filterNodesByQuery 的 id
    expect(ids).toEqual(new Set(filterNodesByQuery(nodes, 'button').map(n => n.id)))
  })

  it('无匹配返回空 Set', () => {
    expect(selectVisibleNodeIds(nodes, 'zzz-nomatch')).toEqual(new Set())
  })
})

describe('filterGraphByVisibleNodeIds', () => {
  it('keeps only matched nodes and edges with two visible endpoints', () => {
    const graph: OmniGraph = {
      nodes,
      edges: [{
        id: 'node-a-to-b', source: nodeA.id, target: nodeB.id, type: 'renders', confidence: 'certain', metadata: {},
      }],
    }

    expect(filterGraphByVisibleNodeIds(graph, new Set([nodeB.id]))).toEqual({ nodes: [nodeB], edges: [] })
  })
})
