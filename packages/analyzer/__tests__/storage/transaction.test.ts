import { describe, expect, it } from 'vitest'
import type { OmniNode, ProjectSnapshot } from '@codeomnivis/shared'
import {
  EdgeRepository,
  ErrorRepository,
  GraphRepository,
  NodeRepository,
  openSqlDatabase,
  replaceSnapshot,
  StatsRepository,
} from '../../src/storage'

function node(name: string): OmniNode {
  return {
    id: `component:src/${name}.tsx:${name}`,
    type: 'component',
    name,
    filePath: `src/${name}.tsx`,
    line: 1,
    column: 1,
    metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
  }
}

function snapshot(snapshotId: string, graphNode: OmniNode): ProjectSnapshot {
  return {
    schemaVersion: 1,
    snapshotId,
    snapshotDigest: snapshotId.padEnd(64, '0'),
    project: {
      root: '/fixture',
      fingerprint: `fingerprint-${snapshotId}`,
      meta: {
        root: '/fixture',
        frontendFramework: 'unknown',
        backendFramework: 'unknown',
        databaseType: 'unknown',
        monorepoType: 'none',
        frontendDirs: ['src'],
        backendDirs: [],
        trpcRouterPaths: [],
        tsrpcServicePaths: [],
        tsrpcApiDirs: [],
        tsrpcProtocolDirs: [],
        prismaSchemaPath: null,
        typeormEntityDirs: [],
        tsConfigPath: null,
        buildFile: null,
        packages: [],
      },
    },
    graph: { nodes: [graphNode], edges: [] },
    issues: [],
    parseErrors: [],
    stats: {
      filesScanned: 1,
      nodeCount: 1,
      edgeCount: 0,
      issueCount: 0,
      parseErrorCount: 0,
      nodeTypeCounts: { component: 1 },
      edgeTypeCounts: {},
      issueSeverityCounts: { critical: 0, warning: 0, info: 0 },
      parseErrorSeverityCounts: { error: 0, warning: 0, info: 0 },
    },
    freshness: { state: 'fresh', lastAnalyzedAt: 1, pendingChanges: 0 },
    provenance: {
      generatedAt: 1,
      analyzerVersion: 'test',
      filesScanned: 1,
      sourceDigest: `source-${snapshotId}`,
    },
  }
}

describe('transactional snapshot replacement', () => {
  it('keeps snapshot A readable when snapshot B fails after writing nodes', async () => {
    const database = await openSqlDatabase(':memory:')
    const nodes = new NodeRepository(database)
    const edges = new EdgeRepository(database)
    const errors = new ErrorRepository(database)
    const graph = new GraphRepository(database, nodes, edges, errors)
    const repositories = {
      database,
      nodes,
      edges,
      errors,
      graph,
      stats: new StatsRepository(database),
    }
    const snapshotA = snapshot('a', node('A'))
    const snapshotB = snapshot('b', node('B'))

    replaceSnapshot(snapshotA, repositories)

    expect(() =>
      replaceSnapshot(snapshotB, {
        ...repositories,
        edges: {
          replaceAll(): number {
            throw new Error('injected failure after nodes')
          },
        },
      }),
    ).toThrow('injected failure after nodes')

    expect(graph.loadSnapshot()).toEqual(snapshotA)
    expect(graph.load()).toEqual(snapshotA.graph)
    database.close()
  })
})
