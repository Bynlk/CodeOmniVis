import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { OmniEdge, OmniNode } from '@codeomnivis/shared'
import {
  EdgeRepository,
  ErrorRepository,
  GraphRepository,
  NodeRepository,
  SQL,
  openSqlDatabase,
  type SqlDatabase,
} from '../../src/storage'

const nodes: OmniNode[] = [
  {
    id: 'page',
    type: 'page',
    name: 'Home',
    filePath: 'app/page.tsx',
    line: 1,
    column: 1,
    metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
  },
  {
    id: 'component',
    type: 'component',
    name: 'Card',
    filePath: 'components/Card.tsx',
    line: 1,
    column: 1,
    metadata: { props: ['id'], hasState: true, isPage: false, jsxChildCount: 1 },
  },
  {
    id: 'api_route',
    type: 'api_route',
    name: 'GET /api',
    filePath: 'app/api/route.ts',
    line: 1,
    column: 1,
    metadata: { method: 'GET', route: '/api', isNextApiRoute: true },
  },
  {
    id: 'trpc',
    type: 'trpc_procedure',
    name: 'orders.list',
    filePath: 'server/trpc.ts',
    line: 1,
    column: 1,
    metadata: {
      procedureType: 'query',
      routerName: 'orders',
      procedureName: 'list',
      hasInput: true,
      hasOutput: true,
      isRouter: false,
    },
  },
  {
    id: 'tsrpc_service',
    type: 'tsrpc_service',
    name: 'Ping',
    filePath: 'protocol/Ping.ts',
    line: 1,
    column: 1,
    metadata: {
      servicePath: 'Ping',
      transport: 'http',
      reqTypeName: 'ReqPing',
      resTypeName: 'ResPing',
      hasCustomError: false,
      isMessage: false,
    },
  },
  {
    id: 'tsrpc_api',
    type: 'tsrpc_api',
    name: 'Ping',
    filePath: 'api/Ping.ts',
    line: 1,
    column: 1,
    metadata: {
      apiPath: 'Ping',
      transport: 'http',
      reqTypeName: 'ReqPing',
      resTypeName: 'ResPing',
      hasCustomError: false,
      conf: { auth: true },
      protocolFilePath: 'protocol/Ping.ts',
    },
  },
  {
    id: 'tsrpc_msg',
    type: 'tsrpc_msg',
    name: 'Changed',
    filePath: 'protocol/Changed.ts',
    line: 1,
    column: 1,
    metadata: {
      msgName: 'Changed',
      msgTypeName: 'MsgChanged',
      transport: 'ws',
      hasImplementation: true,
    },
  },
  {
    id: 'express',
    type: 'express_route',
    name: '/health',
    filePath: 'routes.ts',
    line: 1,
    column: 1,
    metadata: { method: 'GET', route: '/health', middleware: ['auth'] },
  },
  {
    id: 'handler',
    type: 'handler',
    name: 'handler',
    filePath: 'handler.ts',
    line: 1,
    column: 1,
    metadata: { functionName: 'handler', routeId: 'api_route', isSynthetic: false },
  },
  {
    id: 'service',
    type: 'service',
    name: 'OrdersService',
    filePath: 'service.ts',
    line: 1,
    column: 1,
    metadata: {
      className: 'OrdersService',
      methodName: 'list',
      isSynthetic: false,
      importedFrom: './service',
      discoveredBySymbolResolver: true,
    },
  },
  {
    id: 'db',
    type: 'db_model',
    name: 'Order',
    filePath: 'schema.ts',
    line: 1,
    column: 1,
    metadata: {
      tableName: 'orders',
      fieldCount: 1,
      fields: [{ name: 'id', type: 'number', isRequired: true, isId: true, isRelation: false }],
    },
  },
  {
    id: 'module',
    type: 'module',
    name: 'Orders',
    filePath: 'orders.module.ts',
    line: 1,
    column: 1,
    metadata: {
      childCount: 2,
      childTypes: ['service', 'api_route'],
      routePrefix: '/orders',
      dirPath: 'orders',
    },
  },
  {
    id: 'k_class',
    type: 'kotlin_class',
    name: 'Order',
    filePath: 'Order.kt',
    line: 1,
    column: 1,
    metadata: {
      className: 'Order',
      kind: 'data',
      packageName: 'demo',
      annotations: ['Serializable'],
      superClass: 'Base',
      interfaces: ['Entity'],
    },
  },
  {
    id: 'k_interface',
    type: 'kotlin_interface',
    name: 'Store',
    filePath: 'Store.kt',
    line: 1,
    column: 1,
    metadata: {
      interfaceName: 'Store',
      packageName: 'demo',
      annotations: [],
      superInterfaces: ['Closeable'],
    },
  },
  {
    id: 'k_object',
    type: 'kotlin_object',
    name: 'Config',
    filePath: 'Config.kt',
    line: 1,
    column: 1,
    metadata: { objectName: 'Config', packageName: 'demo', isCompanion: false, annotations: [] },
  },
  {
    id: 'k_function',
    type: 'kotlin_function',
    name: 'find',
    filePath: 'Find.kt',
    line: 1,
    column: 1,
    metadata: {
      functionName: 'find',
      packageName: 'demo',
      isTopLevel: true,
      isExtension: true,
      receiverType: 'Store',
      returnType: 'Order',
      annotations: [],
    },
  },
  {
    id: 'k_route',
    type: 'kotlin_route',
    name: 'GET /orders',
    filePath: 'Routes.kt',
    line: 1,
    column: 1,
    metadata: { method: 'GET', path: '/orders', framework: 'ktor', annotations: ['Get'] },
  },
  {
    id: 'suite',
    type: 'test_suite',
    name: 'orders',
    filePath: 'orders.test.ts',
    line: 1,
    column: 1,
    metadata: { framework: 'vitest', kind: 'describe' },
  },
  {
    id: 'case',
    type: 'test_case',
    name: 'orders > list',
    filePath: 'orders.test.ts',
    line: 2,
    column: 1,
    metadata: {
      framework: 'vitest',
      isParameterized: true,
      parameterSource: 'cases',
      disabled: false,
    },
  },
  {
    id: 'fixture',
    type: 'test_fixture',
    name: 'beforeEach',
    filePath: 'orders.test.ts',
    line: 1,
    column: 1,
    metadata: { framework: 'vitest', lifecycle: 'before_each' },
  },
]

const edgeMetadata: Record<OmniEdge['type'], OmniEdge['metadata']> = {
  renders: { jsxLine: 2 },
  navigates_to: { method: 'push' },
  calls_api: { callType: 'fetch', callLine: 3, method: 'GET', url: '/api', matchedFrom: 'literal' },
  handles: { handlerName: 'handler' },
  calls_service: { serviceName: 'OrdersService', callLine: 4 },
  queries_db: { operation: 'findMany', callLine: 5, repository: 'Order' },
  db_relation: { relationType: 'one_to_many', relationName: 'orders.items', fieldName: 'items' },
  imports: { importPath: './orders', importedNames: ['Order'], isTypeOnly: false },
  contains: { reason: 'directory', routerName: 'orders', procedureName: 'list' },
  kotlin_inherits: { superClass: 'Base', line: 1 },
  kotlin_implements: { interfaceName: 'Store', line: 1 },
  kotlin_uses: { usageType: 'field', line: 1 },
  data_flows_to: { typeName: 'Order', transferMethod: 'return_type' },
  sends_msg: { msgName: 'Changed', callLine: 1 },
  listens_msg: { msgName: 'Changed', callLine: 1 },
  tests: { relation: 'contains_case' },
  covers: { evidence: 'direct_call' },
  uses_fixture: { usage: 'lexical_scope' },
}

const edges = Object.entries(edgeMetadata).map(([type, metadata], index) => ({
  id: `edge-${type}`,
  source: index % 2 === 0 ? 'page' : 'component',
  target: index % 2 === 0 ? 'component' : 'page',
  type,
  confidence: index % 2 === 0 ? 'certain' : 'inferred',
  metadata,
})) as OmniEdge[]

describe('typed repositories', () => {
  let database: SqlDatabase
  let nodeRepository: NodeRepository
  let edgeRepository: EdgeRepository
  let errorRepository: ErrorRepository
  let graphRepository: GraphRepository

  beforeEach(async () => {
    database = await openSqlDatabase(':memory:')
    nodeRepository = new NodeRepository(database)
    edgeRepository = new EdgeRepository(database)
    errorRepository = new ErrorRepository(database)
    graphRepository = new GraphRepository(database, nodeRepository, edgeRepository, errorRepository)
  })

  afterEach(() => database.close())

  it('round-trips every typed node and edge metadata contract', () => {
    expect(nodeRepository.replaceAll(nodes)).toBe(nodes.length)
    expect(edgeRepository.replaceAll(edges)).toBe(edges.length)

    expect(nodeRepository.all()).toEqual(nodes)
    expect(edgeRepository.all()).toEqual(edges)
    expect(nodeRepository.byTypes(['page', 'service']).map((node) => node.id)).toEqual([
      'page',
      'service',
    ])
    expect(nodeRepository.byTypes([])).toEqual([])
    expect(nodeRepository.byType('db_model')[0]?.id).toBe('db')
    expect(nodeRepository.byFile('service.ts')[0]?.id).toBe('service')
    expect(nodeRepository.findByRoute('/api')?.id).toBe('api_route')
    expect(nodeRepository.findByFilePath('service.ts')?.id).toBe('service')
    expect(nodeRepository.findByName('OrdersService')?.id).toBe('service')
    expect(edgeRepository.byType('covers')[0]?.metadata).toEqual({ evidence: 'direct_call' })
    expect(edgeRepository.outgoing('page').length).toBeGreaterThan(0)
    expect(edgeRepository.incoming('page').length).toBeGreaterThan(0)
  })

  it('supports graph traversal, cycles, cleanup, metadata, and deletion', () => {
    nodeRepository.replaceAll(nodes)
    edgeRepository.replaceAll([
      {
        id: 'page-handler',
        source: 'page',
        target: 'handler',
        type: 'calls_api',
        confidence: 'certain',
        metadata: { callType: 'fetch', callLine: 1 },
      },
      {
        id: 'handler-service',
        source: 'handler',
        target: 'service',
        type: 'calls_service',
        confidence: 'certain',
        metadata: {},
      },
      {
        id: 'module-service',
        source: 'module',
        target: 'service',
        type: 'contains',
        confidence: 'certain',
        metadata: { reason: 'directory' },
      },
      {
        id: 'service-module',
        source: 'service',
        target: 'module',
        type: 'contains',
        confidence: 'certain',
        metadata: { reason: 'directory' },
      },
    ])
    expect(graphRepository.downstream('module', ['contains']).map((node) => node.id)).toEqual([
      'service',
    ])
    expect(graphRepository.upstream('service', ['contains']).map((node) => node.id)).toEqual([
      'module',
    ])
    expect(graphRepository.affectedPages('service').map((node) => node.id)).toEqual(['page'])
    expect(graphRepository.subtree('module', 'contains', 10)?.children[0]?.children).toEqual([])
    expect(graphRepository.subtree('missing', 'contains', 1)).toBeNull()
    expect(
      graphRepository.subtree('module', 'contains', Number.POSITIVE_INFINITY)?.children,
    ).toEqual([])

    graphRepository.setMeta('key', 'value')
    expect(graphRepository.getMeta('key')).toBe('value')
    expect(graphRepository.getMeta('missing')).toBeNull()
    nodeRepository.delete('fixture')
    edgeRepository.delete('page-handler')
    expect(nodeRepository.get('fixture')).toBeNull()
    expect(edgeRepository.get('page-handler')).toBeNull()
  })

  it('degrades corrupt rows and removes dangling edges', () => {
    nodeRepository.replaceAll(nodes.slice(0, 2))
    database.run(SQL.insertNode, ['fallback', 'invalid', 7, 8, null, 'bad', '{'])
    database.run(SQL.insertEdge, ['invalid-edge', 'page', 'component', 'invalid', 'guess', '{'])
    database.run('PRAGMA foreign_keys = OFF')
    database.run(SQL.insertEdge, ['dangling', 'missing', 'component', 'imports', 'certain', '{}'])
    database.run('PRAGMA foreign_keys = ON')

    expect(nodeRepository.get('fallback')).toMatchObject({ type: 'module', name: '7', line: 0 })
    expect(edgeRepository.get('invalid-edge')).toMatchObject({
      type: 'imports',
      confidence: 'inferred',
    })
    expect(edgeRepository.removeDangling()).toBe(1)
  })

  it('persists parser errors and clear removes the complete graph state', () => {
    graphRepository.save({ nodes: nodes.slice(0, 2), edges: edges.slice(0, 1) })
    errorRepository.replaceAll([
      { file: 'a.ts', message: 'bad', severity: 'error', originalError: 'stack' },
      { file: 'b.ts', message: 'warn', severity: 'warning' },
    ])
    expect(errorRepository.all()).toEqual([
      { file: 'a.ts', message: 'bad', severity: 'error', originalError: 'stack' },
      { file: 'b.ts', message: 'warn', severity: 'warning' },
    ])
    expect(graphRepository.load().nodes).toHaveLength(2)
    graphRepository.clear()
    expect(graphRepository.load()).toEqual({ nodes: [], edges: [] })
    expect(errorRepository.all()).toEqual([])
  })
})
