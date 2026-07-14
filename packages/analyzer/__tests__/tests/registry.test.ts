import { describe, expect, it } from 'vitest'
import type { TestAdapter, TestDiscoveryContext } from '../../src/tests'
import { discoverTests } from '../../src/tests'

const context: TestDiscoveryContext = {
  projectRoot: '/fixture',
  projectMeta: {
    root: '/fixture',
    frontendFramework: 'unknown',
    backendFramework: 'unknown',
    databaseType: 'unknown',
    monorepoType: 'none',
    frontendDirs: [],
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
  tsConfig: null,
  pathAliases: {},
  knownProductionNodes: [],
}

describe('test adapter registry', () => {
  it('isolates adapter failures and continues in deterministic order', async () => {
    const adapters: TestAdapter[] = [
      {
        name: 'declines',
        canHandle: () => false,
        discover: async () => ({ nodes: [], edges: [], errors: [] }),
      },
      {
        name: 'broken',
        canHandle: () => true,
        discover: async () => {
          throw new Error('broken adapter')
        },
      },
      {
        name: 'working',
        canHandle: () => true,
        discover: async () => ({
          nodes: [
            {
              id: 'test_suite:test.ts:suite',
              type: 'test_suite',
              name: 'suite',
              filePath: 'test.ts',
              line: 1,
              column: 1,
              metadata: { framework: 'vitest', kind: 'file' },
            },
          ],
          edges: [],
          errors: [],
        }),
      },
    ]

    const result = await discoverTests('test.ts', context, adapters)

    expect(result.nodes.map((node) => node.name)).toEqual(['suite'])
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'test.ts',
        severity: 'warning',
        message: expect.stringContaining('broken'),
      }),
    ])
  })
})
