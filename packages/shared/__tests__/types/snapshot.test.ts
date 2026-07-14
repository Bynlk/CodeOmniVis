import { describe, expect, it } from 'vitest'
import type { ProjectSnapshot, TestRunImport } from '../../src/types/snapshot'
import { computeSnapshotDigest } from '../../src/node/stableDigest'

function snapshot(): ProjectSnapshot {
  return {
    schemaVersion: 1,
    snapshotId: 'snapshot-a',
    snapshotDigest: '',
    project: {
      root: '/Users/example/project',
      fingerprint: 'project-fingerprint',
      meta: {
        root: '/Users/example/project',
        frontendFramework: 'next',
        backendFramework: 'trpc',
        databaseType: 'prisma',
        monorepoType: 'none',
        frontendDirs: ['app'],
        backendDirs: ['server'],
        trpcRouterPaths: ['/Users/example/project/server/router.ts'],
        tsrpcServicePaths: [],
        tsrpcApiDirs: [],
        tsrpcProtocolDirs: [],
        prismaSchemaPath: '/Users/example/project/prisma/schema.prisma',
        typeormEntityDirs: [],
        tsConfigPath: '/Users/example/project/tsconfig.json',
        buildFile: null,
        packages: [],
      },
    },
    graph: {
      nodes: [
        {
          id: 'page:app/page.tsx:Home',
          type: 'page',
          name: 'Home',
          filePath: 'app/page.tsx',
          line: 1,
          column: 1,
          metadata: {
            route: '/',
            isDynamic: false,
            params: [],
            isGroupLayout: false,
            layoutFile: null,
          },
        },
        {
          id: 'component:components/Hero.tsx:Hero',
          type: 'component',
          name: 'Hero',
          filePath: 'components/Hero.tsx',
          line: 2,
          column: 1,
          metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
        },
      ],
      edges: [
        {
          id: 'page:app/page.tsx:Home--renders--component:components/Hero.tsx:Hero',
          source: 'page:app/page.tsx:Home',
          target: 'component:components/Hero.tsx:Hero',
          type: 'renders',
          confidence: 'certain',
          metadata: { jsxLine: 3 },
        },
      ],
    },
    issues: [
      {
        id: 'issue-b',
        severity: 'info',
        type: 'dead_component',
        description: 'Example issue',
        locations: [{ file: '/Users/example/project/components/Hero.tsx', line: 2 }],
        relatedNodeIds: ['component:components/Hero.tsx:Hero'],
        relatedEdgeIds: [],
      },
    ],
    parseErrors: [
      {
        file: '/Users/example/project/app/broken.tsx',
        message: 'Parser could not read this file',
        severity: 'warning',
        parser: 'react-component',
      },
    ],
    stats: {
      filesScanned: 3,
      nodeCount: 2,
      edgeCount: 1,
      issueCount: 1,
      parseErrorCount: 1,
      nodeTypeCounts: { component: 1, page: 1 },
      edgeTypeCounts: { renders: 1 },
      issueSeverityCounts: { critical: 0, warning: 0, info: 1 },
      parseErrorSeverityCounts: { error: 0, warning: 1, info: 0 },
    },
    freshness: { state: 'fresh', lastAnalyzedAt: 1_000, pendingChanges: 0 },
    provenance: {
      generatedAt: 1_000,
      analyzerVersion: '0.0.1',
      filesScanned: 3,
      sourceDigest: 'source-digest',
    },
  }
}

describe('computeSnapshotDigest', () => {
  it('excludes volatile identifiers, timestamps and the absolute project root', () => {
    const first = snapshot()
    const second = snapshot()
    second.snapshotId = 'snapshot-b'
    second.snapshotDigest = 'previous-digest'
    second.project.root = '/different/checkout'
    second.project.meta.root = '/different/checkout'
    second.project.meta.trpcRouterPaths = ['/different/checkout/server/router.ts']
    second.project.meta.prismaSchemaPath = '/different/checkout/prisma/schema.prisma'
    second.project.meta.tsConfigPath = '/different/checkout/tsconfig.json'
    second.issues[0].locations[0].file = '/different/checkout/components/Hero.tsx'
    second.parseErrors[0].file = '/different/checkout/app/broken.tsx'
    second.provenance.generatedAt = 2_000
    second.freshness.lastAnalyzedAt = 2_000

    expect(computeSnapshotDigest(first)).toBe(computeSnapshotDigest(second))
  })

  it('is independent of graph, issue and parse-error ordering', () => {
    const first = snapshot()
    const second = snapshot()
    second.graph.nodes.reverse()
    second.issues.unshift({
      ...second.issues[0],
      id: 'issue-a',
      description: 'Earlier issue',
    })
    first.issues.push({
      ...first.issues[0],
      id: 'issue-a',
      description: 'Earlier issue',
    })
    second.issues.reverse()
    second.parseErrors.unshift({
      file: '/Users/example/project/app/another.tsx',
      message: 'Another warning',
      severity: 'warning',
    })
    first.parseErrors.push({
      file: '/Users/example/project/app/another.tsx',
      message: 'Another warning',
      severity: 'warning',
    })

    expect(computeSnapshotDigest(first)).toBe(computeSnapshotDigest(second))
  })

  it('normalizes Windows and POSIX path separators', () => {
    const first = snapshot()
    const second = snapshot()
    second.graph.nodes[0].filePath = 'app\\page.tsx'
    second.graph.nodes[1].filePath = 'components\\Hero.tsx'

    expect(computeSnapshotDigest(first)).toBe(computeSnapshotDigest(second))
  })

  it('changes when semantic graph content changes', () => {
    const first = snapshot()
    const second = snapshot()
    second.graph.nodes[0].name = 'ChangedHome'

    expect(computeSnapshotDigest(first)).not.toBe(computeSnapshotDigest(second))
  })

  it('includes imported test results but excludes import time', () => {
    const first = snapshot()
    const second = snapshot()
    const run: TestRunImport = {
      source: 'junit_xml',
      importedAt: 1,
      cases: [{ suite: 'Checkout', name: 'works', status: 'passed', durationMs: 2 }],
      unmatched: [],
    }
    first.provenance.testRuns = [run]
    second.provenance.testRuns = [
      { ...run, importedAt: 999, cases: run.cases.map((result) => ({ ...result })) },
    ]
    expect(computeSnapshotDigest(first)).toBe(computeSnapshotDigest(second))
    second.provenance.testRuns[0].cases[0].status = 'failed'
    expect(computeSnapshotDigest(first)).not.toBe(computeSnapshotDigest(second))
  })
})
