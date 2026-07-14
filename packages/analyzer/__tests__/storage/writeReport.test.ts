import { describe, expect, it } from 'vitest'
import type { OmniEdge, OmniNode, ProjectSnapshot } from '@codeomnivis/shared'
import { OmniDatabase } from '../../src/storage'

function createSnapshot(): ProjectSnapshot {
  const source: OmniNode = {
    id: 'component:src/App.tsx:App',
    type: 'component',
    name: 'App',
    filePath: 'src/App.tsx',
    line: 1,
    column: 1,
    metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
  }
  const dangling: OmniEdge = {
    id: `${source.id}--renders--component:src/Missing.tsx:Missing`,
    source: source.id,
    target: 'component:src/Missing.tsx:Missing',
    type: 'renders',
    confidence: 'certain',
    metadata: {},
  }
  return {
    schemaVersion: 1,
    snapshotId: 'snapshot-with-dangling-edge',
    snapshotDigest: 'd'.repeat(64),
    project: {
      root: '/fixture',
      fingerprint: 'fixture',
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
    graph: { nodes: [source], edges: [dangling] },
    issues: [],
    parseErrors: [],
    stats: {
      filesScanned: 1,
      nodeCount: 1,
      edgeCount: 1,
      issueCount: 0,
      parseErrorCount: 0,
      nodeTypeCounts: { component: 1 },
      edgeTypeCounts: { renders: 1 },
      issueSeverityCounts: { critical: 0, warning: 0, info: 0 },
      parseErrorSeverityCounts: { error: 0, warning: 0, info: 0 },
    },
    freshness: { state: 'fresh', lastAnalyzedAt: 1, pendingChanges: 0 },
    provenance: {
      generatedAt: 1,
      analyzerVersion: 'test',
      filesScanned: 1,
      sourceDigest: 'source',
    },
  }
}

describe('snapshot write report', () => {
  it('commits valid data and reports an edge whose target is missing', async () => {
    const db = new OmniDatabase(':memory:')
    await db.ready()

    const report = db.replaceSnapshot(createSnapshot())

    expect(report.committed).toBe(true)
    expect(report.edges).toEqual({ attempted: 1, written: 0, rejected: 1 })
    expect(report.rejectedEdges).toEqual([
      expect.objectContaining({ reason: 'missing_target' }),
    ])
    expect(db.loadGraph().edges).toEqual([])
    db.close()
  })
})
