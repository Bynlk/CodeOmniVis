/**
 * GraphBuilder 测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { GraphBuilder } from '../../src/graph/builder'
import { OmniDatabase } from '../../src/storage/db'
import type { OmniNode, OmniEdge, Parser, ParseContext, ProjectMeta, ParseResult } from '@codeomnivis/shared'

// 辅助函数
const PAGE_META = { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null }
const COMPONENT_META = { props: [], hasState: false, isPage: false, jsxChildCount: 0 }

function makeNode(id: string, type: 'page' | 'component' = 'page'): OmniNode {
  if (type === 'component') {
    return { id, type, name: id, filePath: 'test.tsx', line: 1, column: 1, metadata: COMPONENT_META }
  }
  return { id, type, name: id, filePath: 'test.tsx', line: 1, column: 1, metadata: PAGE_META }
}

function makeEdge(id: string, source: string, target: string, type: 'renders' | 'calls_api' = 'renders'): OmniEdge {
  if (type === 'calls_api') {
    return { id, source, target, type, confidence: 'certain', metadata: { callType: 'fetch', callLine: 1 } }
  }
  return { id, source, target, type, confidence: 'certain', metadata: {} }
}

const projectMeta: ProjectMeta = {
  root: '/project',
  frontendFramework: 'next',
  backendFramework: 'trpc',
  databaseType: 'prisma',
  monorepoType: 'none',
  frontendDirs: ['app'],
  backendDirs: ['server'],
  trpcRouterPaths: [],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
}

const context: ParseContext = {
  projectRoot: '/project',
  projectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('GraphBuilder', () => {
  let db: OmniDatabase
  let builder: GraphBuilder

  beforeAll(async () => {
    db = new OmniDatabase(':memory:')
    await db.ready()
    builder = new GraphBuilder(db)
  })

  afterAll(() => {
    db.close()
  })

  it('registerParser 注册的解析器会被 parseFiles 调用', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    let handled = 0
    let parsed = 0
    freshBuilder.registerParser({
      name: 'test',
      canHandle: () => { handled += 1; return true },
      parse: async (): Promise<ParseResult> => {
        parsed += 1
        return { nodes: [makeNode('n1')], edges: [], errors: [] }
      },
    })

    const result = await freshBuilder.parseFiles(['test.tsx'], context)
    expect(handled).toBe(1)
    expect(parsed).toBe(1)
    expect(result.stats.totalNodes).toBe(1)

    freshDb.close()
  })

  it('registerParsers 批量注册:仅 canHandle 命中的解析器产出节点', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    const invoked: string[] = []
    freshBuilder.registerParsers([
      {
        name: 'a',
        canHandle: () => false,
        parse: async (): Promise<ParseResult> => {
          invoked.push('a')
          return { nodes: [makeNode('a-node')], edges: [], errors: [] }
        },
      },
      {
        name: 'b',
        canHandle: () => true,
        parse: async (): Promise<ParseResult> => {
          invoked.push('b')
          return { nodes: [makeNode('b-node')], edges: [], errors: [] }
        },
      },
    ])

    const result = await freshBuilder.parseFiles(['test.tsx'], context)
    // a 的 canHandle 为 false,不应被调用;只有 b 产出节点。
    expect(invoked).toEqual(['b'])
    expect(result.stats.totalNodes).toBe(1)
    expect(result.graph.nodes[0].id).toBe('b-node')

    freshDb.close()
  })

  it('parseFiles 正确解析并写入数据库', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    const nodeA = makeNode('a')
    const nodeB = makeNode('b', 'component')
    const edge = makeEdge('e1', 'a', 'b')

    freshBuilder.registerParser({
      name: 'mock',
      canHandle: () => true,
      parse: async (): Promise<ParseResult> => ({
        nodes: [nodeA, nodeB],
        edges: [edge],
        errors: [],
      }),
    })

    const result = await freshBuilder.parseFiles(['test.tsx'], context)

    expect(result.stats.totalNodes).toBe(2)
    expect(result.stats.totalEdges).toBe(1)
    expect(result.stats.skippedEdges).toBe(0)
    expect(result.graph.nodes).toHaveLength(2)
    expect(result.graph.edges).toHaveLength(1)

    // 验证数据库写入
    const loaded = freshDb.loadGraph()
    expect(loaded.nodes).toHaveLength(2)
    expect(loaded.edges).toHaveLength(1)

    freshDb.close()
  })

  it('节点去重：同 ID 保留最后一个', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    const node1 = makeNode('dup')
    const node2 = { ...makeNode('dup'), name: 'updated' }

    freshBuilder.registerParser({
      name: 'mock',
      canHandle: () => true,
      parse: async (): Promise<ParseResult> => ({
        nodes: [node1, node2],
        edges: [],
        errors: [],
      }),
    })

    const result = await freshBuilder.parseFiles(['test.tsx'], context)
    expect(result.stats.totalNodes).toBe(1)
    expect(result.graph.nodes[0].name).toBe('updated')

    freshDb.close()
  })

  it('验证边的 source/target 存在', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    freshBuilder.registerParser({
      name: 'mock',
      canHandle: () => true,
      parse: async (): Promise<ParseResult> => ({
        nodes: [makeNode('a')],
        edges: [makeEdge('e1', 'a', 'nonexistent')],
        errors: [],
      }),
    })

    const result = await freshBuilder.parseFiles(['test.tsx'], context)
    expect(result.stats.skippedEdges).toBe(1)
    expect(result.graph.edges).toHaveLength(0)

    freshDb.close()
  })

  it('calls_api 边允许 target 不存在', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    freshBuilder.registerParser({
      name: 'mock',
      canHandle: () => true,
      parse: async (): Promise<ParseResult> => ({
        nodes: [makeNode('a')],
        edges: [makeEdge('e1', 'a', 'nonexistent', 'calls_api')],
        errors: [],
      }),
    })

    const result = await freshBuilder.parseFiles(['test.tsx'], context)
    expect(result.stats.skippedEdges).toBe(0)
    expect(result.graph.edges).toHaveLength(1)

    freshDb.close()
  })

  it('links a page route through its page component without duplicate child fan-out', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-page-hierarchy-'))
    const pageFile = path.join(projectRoot, 'app', 'page.tsx')
    fs.mkdirSync(path.dirname(pageFile), { recursive: true })
    fs.writeFileSync(pageFile, "import Child from '../components/Child'\nexport default function HomePage() { return <Child /> }")

    const page: OmniNode = {
      id: 'page:app/page.tsx:/',
      type: 'page',
      name: '/',
      filePath: 'app/page.tsx',
      line: 2,
      column: 1,
      metadata: PAGE_META,
    }
    const pageComponent: OmniNode = {
      id: 'component:app/page.tsx:HomePage',
      type: 'component',
      name: 'HomePage',
      filePath: 'app/page.tsx',
      line: 2,
      column: 1,
      metadata: { ...COMPONENT_META, isPage: true },
    }
    const child: OmniNode = {
      id: 'component:components/Child.tsx:Child',
      type: 'component',
      name: 'Child',
      filePath: 'components/Child.tsx',
      line: 1,
      column: 1,
      metadata: COMPONENT_META,
    }
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)
    freshBuilder.registerParser({
      name: 'page-fixture',
      canHandle: () => true,
      parse: async (): Promise<ParseResult> => ({ nodes: [page, pageComponent, child], edges: [], errors: [] }),
    })

    try {
      const result = await freshBuilder.parseFiles(['app/page.tsx'], {
        ...context,
        projectRoot,
        projectMeta: { ...projectMeta, root: projectRoot },
      })
      expect(result.graph.edges.filter(edge => edge.type === 'renders').map(edge =>
        `${edge.source}->${edge.target}`
      ).sort()).toEqual([
        `${pageComponent.id}->${child.id}`,
        `${page.id}->${pageComponent.id}`,
      ])
    } finally {
      freshDb.close()
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it('loadGraph 从数据库加载已写入的节点', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    freshBuilder.registerParser({
      name: 'mock',
      canHandle: () => true,
      parse: async (): Promise<ParseResult> => ({
        nodes: [makeNode('lg-a'), makeNode('lg-b', 'component')],
        edges: [makeEdge('lg-e', 'lg-a', 'lg-b')],
        errors: [],
      }),
    })
    await freshBuilder.parseFiles(['test.tsx'], context)

    const graph = freshBuilder.loadGraph()
    expect(graph.nodes.map(n => n.id).sort()).toEqual(['lg-a', 'lg-b'])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].id).toBe('lg-e')

    freshDb.close()
  })

  it('clearGraph 清空图', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    freshDb.upsertNode(makeNode('x'))
    const freshBuilder = new GraphBuilder(freshDb)

    // 清空前确有数据
    expect(freshBuilder.loadGraph().nodes).toHaveLength(1)

    freshBuilder.clearGraph()
    const graph = freshBuilder.loadGraph()
    expect(graph.nodes).toHaveLength(0)

    freshDb.close()
  })

  it('解析器异常被捕获并记录', async () => {
    const freshDb = new OmniDatabase(':memory:')
    await freshDb.ready()
    const freshBuilder = new GraphBuilder(freshDb)

    freshBuilder.registerParser({
      name: 'broken',
      canHandle: () => true,
      parse: async () => { throw new Error('boom') },
    })

    const result = await freshBuilder.parseFiles(['test.tsx'], context)
    expect(result.stats.totalErrors).toBe(1)
    expect(result.stats.totalNodes).toBe(0)

    freshDb.close()
  })
})
