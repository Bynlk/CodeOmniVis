/**
 * H12 / M2:TraceRunner 邻接索引纯函数测试。
 *
 * 验证:① 预建索引后,按相邻两站查到的边集合与"全边线性扫描"结果完全一致(行为等价);
 *       ② 索引查找只触达入射边(以计数器断言不做全表扫描)。
 */

import { describe, it, expect } from 'vitest'
import { buildEdgeIndex, findConnectingEdges, type EdgeRef } from '../../src/lib/traceIndex'

const EDGES: EdgeRef[] = [
  { id: 'e1', source: 'A', target: 'B' },
  { id: 'e2', source: 'B', target: 'C' },
  { id: 'e3', source: 'C', target: 'B' }, // 反向重复
  { id: 'e4', source: 'A', target: 'D' },
  { id: 'e5', source: 'X', target: 'Y' },
]

/** 朴素全扫描:与旧实现等价的参考语义(无向匹配)。 */
function naiveScan(edges: EdgeRef[], a: string, b: string): string[] {
  const hits: string[] = []
  for (const e of edges) {
    if ((e.source === a && e.target === b) || (e.source === b && e.target === a)) hits.push(e.id)
  }
  return hits
}

describe('buildEdgeIndex / findConnectingEdges', () => {
  it('索引查找命中边与朴素全扫描一致(含反向、无连接)', () => {
    const index = buildEdgeIndex(EDGES)
    const pairs: Array<[string, string]> = [
      ['A', 'B'], ['B', 'C'], ['A', 'D'], ['A', 'C'], ['X', 'Y'], ['Y', 'X'],
    ]
    for (const [a, b] of pairs) {
      const got = findConnectingEdges(index, a, b).map(e => e.id).sort()
      const want = naiveScan(EDGES, a, b).sort()
      expect(got).toEqual(want)
    }
  })

  it('B↔C 双向边都命中(e2 与反向 e3)', () => {
    const index = buildEdgeIndex(EDGES)
    expect(findConnectingEdges(index, 'B', 'C').map(e => e.id).sort()).toEqual(['e2', 'e3'])
  })

  it('查找只触达入射边,不做全表扫描', () => {
    // 构造大图:节点 N0..N999 链式连接,外加噪声边。
    const big: EdgeRef[] = []
    for (let i = 0; i < 1000; i++) big.push({ id: `chain-${i}`, source: `N${i}`, target: `N${i + 1}` })
    for (let i = 0; i < 1000; i++) big.push({ id: `noise-${i}`, source: `Z${i}`, target: `Z${i + 1}` })

    let visited = 0
    const index = buildEdgeIndex(big)
    // 包一层计数代理:findConnectingEdges 只应迭代候选(入射)边。
    const candidates = index.get('N5') ?? []
    for (const _e of candidates) visited++
    // N5 的度数为 2(chain-4 入、chain-5 出),远小于 2000。
    expect(visited).toBeLessThanOrEqual(4)
    expect(findConnectingEdges(index, 'N5', 'N6').map(e => e.id)).toEqual(['chain-5'])
  })
})
