import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CypressAdapter } from '../../../src/tests/typescript/cypressAdapter'
import type { TestDiscoveryContext } from '../../../src/tests'

const root = path.resolve(__dirname, '../../fixtures/tests/typescript')
const context: TestDiscoveryContext = {
  projectRoot: root,
  projectMeta: { root, frontendFramework: 'unknown', backendFramework: 'unknown', databaseType: 'unknown', monorepoType: 'none', frontendDirs: [], backendDirs: [], trpcRouterPaths: [], tsrpcServicePaths: [], tsrpcApiDirs: [], tsrpcProtocolDirs: [], prismaSchemaPath: null, typeormEntityDirs: [], tsConfigPath: null, buildFile: null, packages: [] },
  tsConfig: null, pathAliases: {}, knownProductionNodes: [],
}

describe('CypressAdapter', () => {
  it('discovers suite, case, hook and route references without Jest evidence', async () => {
    const result = await CypressAdapter.discover('cypress/orders.fixture.ts', context)
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'test_suite', metadata: expect.objectContaining({ framework: 'cypress' }) }),
      expect.objectContaining({ type: 'test_case', name: 'orders browser > creates an order' }),
      expect.objectContaining({ type: 'test_fixture', metadata: expect.objectContaining({ lifecycle: 'before_each' }) }),
    ]))
  })
})
