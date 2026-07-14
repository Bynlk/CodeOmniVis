import type { EdgeType, NodeType, OmniGraph, OmniNode, ProjectSnapshot } from '@codeomnivis/shared'
import type { SqlDatabase } from './database'
import type { EdgeRepository } from './edgeRepository'
import type { ErrorRepository } from './errorRepository'
import type { NodeRepository } from './nodeRepository'
import { SQL } from './schema'

export interface GraphSubtree {
  id: string
  name: string
  type: NodeType
  children: GraphSubtree[]
}

const MAX_SUBTREE_DEPTH = 1000

export class GraphRepository {
  constructor(
    private readonly database: SqlDatabase,
    private readonly nodes: NodeRepository,
    private readonly edges: EdgeRepository,
    private readonly errors: ErrorRepository,
  ) {}

  save(graph: OmniGraph): { nodesSaved: number; edgesSaved: number } {
    return {
      nodesSaved: this.nodes.replaceAll(graph.nodes),
      edgesSaved: this.edges.replaceAll(graph.edges),
    }
  }

  load(): OmniGraph {
    return { nodes: this.nodes.all(), edges: this.edges.all() }
  }

  clear(): void {
    this.edges.clear()
    this.nodes.clear()
    this.errors.clear()
    this.database.run(SQL.deleteSnapshots)
  }

  saveSnapshot(snapshot: ProjectSnapshot): void {
    this.database.run(SQL.insertSnapshot, [
      snapshot.snapshotId,
      snapshot.snapshotDigest,
      JSON.stringify(snapshot),
    ])
  }

  loadSnapshot(): ProjectSnapshot | null {
    const statement = this.database.prepare(SQL.selectLatestSnapshot)
    try {
      if (!statement.step()) return null
      const payload = statement.getAsObject().payload
      if (typeof payload !== 'string') return null
      try {
        const parsed: unknown = JSON.parse(payload)
        return parsed && typeof parsed === 'object' ? parsed as ProjectSnapshot : null
      } catch {
        return null
      }
    } finally {
      statement.free()
    }
  }

  setMeta(key: string, value: string): void {
    this.database.run(SQL.setMeta, [key, value])
  }

  getMeta(key: string): string | null {
    const statement = this.database.prepare(SQL.getMeta)
    try {
      statement.bind([key])
      if (!statement.step()) return null
      const value = statement.getAsObject().value
      return typeof value === 'string' ? value : String(value ?? '')
    } finally {
      statement.free()
    }
  }

  downstream(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
    const allowed = edgeTypes ? new Set<EdgeType>(edgeTypes) : null
    return this.edges.outgoing(nodeId)
      .filter(edge => !allowed || allowed.has(edge.type))
      .map(edge => this.nodes.get(edge.target))
      .filter((node): node is OmniNode => node !== null)
  }

  upstream(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
    const allowed = edgeTypes ? new Set<EdgeType>(edgeTypes) : null
    return this.edges.incoming(nodeId)
      .filter(edge => !allowed || allowed.has(edge.type))
      .map(edge => this.nodes.get(edge.source))
      .filter((node): node is OmniNode => node !== null)
  }

  affectedPages(nodeId: string, maxDepth = 10): OmniNode[] {
    const visited = new Set<string>()
    const pages = new Map<string, OmniNode>()
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]
    const callEdges: EdgeType[] = ['calls_api', 'handles', 'calls_service', 'queries_db']
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || visited.has(current.id) || current.depth > maxDepth) continue
      visited.add(current.id)
      for (const node of this.upstream(current.id, callEdges)) {
        if (node.type === 'page') pages.set(node.id, node)
        else queue.push({ id: node.id, depth: current.depth + 1 })
      }
    }
    return [...pages.values()]
  }

  subtree(rootId: string, edgeType: EdgeType, maxDepth: number): GraphSubtree | null {
    const root = this.nodes.get(rootId)
    if (!root) return null
    const depth = Number.isFinite(maxDepth)
      ? Math.min(Math.max(Math.trunc(maxDepth), 0), MAX_SUBTREE_DEPTH)
      : 0
    return this.buildSubtree(root, edgeType, depth, new Set<string>())
  }

  private buildSubtree(
    root: OmniNode,
    edgeType: EdgeType,
    depth: number,
    visited: Set<string>,
  ): GraphSubtree {
    visited.add(root.id)
    const children: GraphSubtree[] = []
    if (depth > 0) {
      for (const node of this.downstream(root.id, [edgeType])) {
        if (!visited.has(node.id)) children.push(this.buildSubtree(node, edgeType, depth - 1, visited))
      }
    }
    return { id: root.id, name: root.name, type: root.type, children }
  }
}
