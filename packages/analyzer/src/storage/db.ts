import type {
  EdgeType,
  NodeType,
  OmniEdge,
  OmniGraph,
  OmniNode,
  ProjectSnapshot,
  WriteReport,
} from '@codeomnivis/shared'
import { openSqlDatabase, type SqlDatabase } from './database'
import { EdgeRepository } from './edgeRepository'
import { ErrorRepository, type DbError } from './errorRepository'
import { GraphRepository, type GraphSubtree } from './graphRepository'
import { NodeRepository } from './nodeRepository'
import { replaceSnapshot, type Repositories } from './persistence'
import { StatsRepository, type DbStats } from './statsRepository'

export type { DbError } from './errorRepository'
export type { DbStats } from './statsRepository'
export type { GraphSubtree } from './graphRepository'

export interface AnalysisStore {
  ready(): Promise<void>
  replaceSnapshot(snapshot: ProjectSnapshot): WriteReport
  loadSnapshot(): ProjectSnapshot | null
  loadGraph(): OmniGraph
  getAllErrors(): DbError[]
  close(): void
}

export class OmniDatabase implements AnalysisStore {
  private database: SqlDatabase | null = null
  private repositories: Repositories | null = null
  private readonly initPromise: Promise<void>

  constructor(dbPath = ':memory:') {
    this.initPromise = this.initialize(dbPath)
  }

  private async initialize(dbPath: string): Promise<void> {
    const database = await openSqlDatabase(dbPath)
    const nodes = new NodeRepository(database)
    const edges = new EdgeRepository(database)
    const errors = new ErrorRepository(database)
    this.database = database
    this.repositories = {
      database,
      nodes,
      edges,
      errors,
      graph: new GraphRepository(database, nodes, edges, errors),
      stats: new StatsRepository(database),
    }
  }

  async ready(): Promise<void> {
    await this.initPromise
  }

  close(): void {
    this.database?.close()
    this.database = null
    this.repositories = null
  }

  replaceSnapshot(snapshot: ProjectSnapshot): WriteReport {
    return replaceSnapshot(snapshot, this.requireRepositories())
  }

  loadSnapshot(): ProjectSnapshot | null {
    return this.attempt('load snapshot', null, repositories => repositories.graph.loadSnapshot())
  }

  upsertNode(node: OmniNode): boolean {
    return this.attempt(`upsert node ${node.id}`, false, repositories => {
      repositories.nodes.upsert(node)
      return true
    })
  }

  upsertNodes(nodes: OmniNode[]): number {
    if (nodes.length === 0) return 0
    return this.attempt('upsert nodes', 0, repositories =>
      repositories.database.transaction(() => repositories.nodes.replaceAll(nodes)))
  }

  getNode(id: string): OmniNode | null {
    return this.attempt(`get node ${id}`, null, repositories => repositories.nodes.get(id))
  }

  getAllNodes(): OmniNode[] {
    return this.attempt('get all nodes', [], repositories => repositories.nodes.all())
  }

  getNodesByType(type: NodeType): OmniNode[] {
    return this.attempt(`get nodes by type ${type}`, [], repositories => repositories.nodes.byType(type))
  }

  getNodesByFile(filePath: string): OmniNode[] {
    return this.attempt(`get nodes by file ${filePath}`, [], repositories => repositories.nodes.byFile(filePath))
  }

  deleteNode(id: string): boolean {
    return this.attempt(`delete node ${id}`, false, repositories => {
      repositories.nodes.delete(id)
      return true
    })
  }

  deleteAllNodes(): boolean {
    return this.attempt('delete all nodes', false, repositories => {
      repositories.nodes.clear()
      return true
    })
  }

  upsertEdge(edge: OmniEdge): boolean {
    return this.attempt(`upsert edge ${edge.id}`, false, repositories => {
      repositories.edges.replaceAll([edge])
      return true
    })
  }

  upsertEdges(edges: OmniEdge[]): number {
    if (edges.length === 0) return 0
    return this.attempt('upsert edges', 0, repositories =>
      repositories.database.transaction(() => repositories.edges.replaceAll(edges)))
  }

  getEdge(id: string): OmniEdge | null {
    return this.attempt(`get edge ${id}`, null, repositories =>
      repositories.edges instanceof EdgeRepository ? repositories.edges.get(id) : null)
  }

  getAllEdges(): OmniEdge[] {
    return this.attempt('get all edges', [], repositories => this.edgeRepository(repositories).all())
  }

  getEdgesByType(type: EdgeType): OmniEdge[] {
    return this.attempt(`get edges by type ${type}`, [], repositories => this.edgeRepository(repositories).byType(type))
  }

  getOutEdges(nodeId: string): OmniEdge[] {
    return this.attempt(`get outgoing edges ${nodeId}`, [], repositories => this.edgeRepository(repositories).outgoing(nodeId))
  }

  getInEdges(nodeId: string): OmniEdge[] {
    return this.attempt(`get incoming edges ${nodeId}`, [], repositories => this.edgeRepository(repositories).incoming(nodeId))
  }

  deleteEdge(id: string): boolean {
    return this.attempt(`delete edge ${id}`, false, repositories => {
      this.edgeRepository(repositories).delete(id)
      return true
    })
  }

  deleteAllEdges(): boolean {
    return this.attempt('delete all edges', false, repositories => {
      this.edgeRepository(repositories).clear()
      return true
    })
  }

  insertError(error: DbError): boolean {
    return this.attempt('insert error', false, repositories => {
      repositories.errors.insert(error)
      return true
    })
  }

  insertErrors(errors: DbError[]): number {
    if (errors.length === 0) return 0
    return this.attempt('insert errors', 0, repositories =>
      repositories.database.transaction(() => repositories.errors.replaceAll(errors)))
  }

  getAllErrors(): DbError[] {
    return this.attempt('get all errors', [], repositories => repositories.errors.all())
  }

  deleteAllErrors(): boolean {
    return this.attempt('delete all errors', false, repositories => {
      repositories.errors.clear()
      return true
    })
  }

  setMeta(key: string, value: string): boolean {
    return this.attempt(`set metadata ${key}`, false, repositories => {
      repositories.graph.setMeta(key, value)
      return true
    })
  }

  getMeta(key: string): string | null {
    return this.attempt(`get metadata ${key}`, null, repositories => repositories.graph.getMeta(key))
  }

  saveGraph(graph: OmniGraph): { nodesSaved: number; edgesSaved: number } {
    return this.attempt('save graph', { nodesSaved: 0, edgesSaved: 0 }, repositories =>
      repositories.database.transaction(() => repositories.graph.save(graph)))
  }

  loadGraph(): OmniGraph {
    return this.attempt('load graph', { nodes: [], edges: [] }, repositories => repositories.graph.load())
  }

  clearGraph(): boolean {
    return this.attempt('clear graph', false, repositories => {
      repositories.database.transaction(() => repositories.graph.clear())
      return true
    })
  }

  removeDanglingEdges(): number {
    return this.attempt('remove dangling edges', 0, repositories => this.edgeRepository(repositories).removeDangling())
  }

  getStats(): DbStats {
    const empty = { nodeCount: 0, edgeCount: 0, errorCount: 0, nodeTypeCounts: {}, edgeTypeCounts: {} }
    return this.attempt('get stats', empty, repositories => repositories.stats.get())
  }

  getNodesByTypes(types: NodeType[]): OmniNode[] {
    return this.attempt('get nodes by types', [], repositories => repositories.nodes.byTypes(types))
  }

  getDownstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
    return this.attempt('get downstream nodes', [], repositories => repositories.graph.downstream(nodeId, edgeTypes))
  }

  getUpstreamNodes(nodeId: string, edgeTypes?: EdgeType[]): OmniNode[] {
    return this.attempt('get upstream nodes', [], repositories => repositories.graph.upstream(nodeId, edgeTypes))
  }

  findNodeByRoute(route: string): OmniNode | null {
    return this.attempt('find node by route', null, repositories => repositories.nodes.findByRoute(route))
  }

  findNodeByFilePath(filePath: string): OmniNode | null {
    return this.attempt('find node by file', null, repositories => repositories.nodes.findByFilePath(filePath))
  }

  findNodeByAny(query: string): OmniNode | null {
    return this.findNodeByRoute(query) ?? this.findNodeByFilePath(query)
      ?? this.attempt('find node by name', null, repositories => repositories.nodes.findByName(query))
  }

  getAffectedPages(nodeId: string, maxDepth = 10): OmniNode[] {
    return this.attempt('get affected pages', [], repositories => repositories.graph.affectedPages(nodeId, maxDepth))
  }

  getSubtree(rootId: string, edgeType: EdgeType, maxDepth: number): GraphSubtree | null {
    return this.attempt('get subtree', null, repositories => repositories.graph.subtree(rootId, edgeType, maxDepth))
  }

  private requireRepositories(): Repositories {
    if (!this.repositories) throw new Error('Database not initialized. Call ready() first.')
    return this.repositories
  }

  private edgeRepository(repositories: Repositories): EdgeRepository {
    if (!(repositories.edges instanceof EdgeRepository)) throw new Error('Edge repository is unavailable')
    return repositories.edges
  }

  private attempt<T>(label: string, fallback: T, operation: (repositories: Repositories) => T): T {
    try {
      return operation(this.requireRepositories())
    } catch (error) {
      console.error(`Failed to ${label}:`, error)
      return fallback
    }
  }
}
