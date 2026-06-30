/**
 * H12 / M2:循迹光点邻接索引(纯函数,O(degree) 查找)。
 *
 * 旧实现每步对全部边线性扫描(O(steps x edges))。这里预建一次
 * `Map<nodeId, EdgeRef[]>` 入射索引,之后每对相邻站点只在其中一端的
 * 入射边里筛选,复杂度降为 O(degree)。语义保持无向匹配(容忍方向)。
 */

/** 仅依赖端点 id 的最小边描述(便于脱离 cytoscape 单测)。 */
export interface EdgeRef {
  id: string
  source: string
  target: string
}

/** nodeId → 该节点的入射边列表(source 或 target 命中均计入)。 */
export type EdgeIndex = Map<string, EdgeRef[]>

/** 预建入射索引;同一条边会同时挂到其 source 与 target 名下。 */
export function buildEdgeIndex(edges: readonly EdgeRef[]): EdgeIndex {
  const index: EdgeIndex = new Map()
  const push = (key: string, edge: EdgeRef): void => {
    const bucket = index.get(key)
    if (bucket === undefined) {
      index.set(key, [edge])
    } else {
      bucket.push(edge)
    }
  }
  for (const edge of edges) {
    push(edge.source, edge)
    if (edge.target !== edge.source) push(edge.target, edge)
  }
  return index
}

/**
 * 返回连接 a↔b 的所有边(无向)。仅遍历 a 的入射边,O(degree(a))。
 * 语义与"全边扫描 (s===a&&t===b)||(s===b&&t===a)"完全一致。
 */
export function findConnectingEdges(index: EdgeIndex, a: string, b: string): EdgeRef[] {
  const incident = index.get(a)
  if (incident === undefined) return []
  const hits: EdgeRef[] = []
  for (const edge of incident) {
    if ((edge.source === a && edge.target === b) || (edge.source === b && edge.target === a)) {
      hits.push(edge)
    }
  }
  return hits
}
