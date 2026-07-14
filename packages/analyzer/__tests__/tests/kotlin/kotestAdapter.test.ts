import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { KotestAdapter } from '../../../src/tests/kotlin/kotestAdapter'
import type { TestDiscoveryContext } from '../../../src/tests'

const root = path.resolve(__dirname, '../../fixtures/tests/kotlin')
const context: TestDiscoveryContext = {
  projectRoot: root,
  projectMeta: {
    root,
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

describe('KotestAdapter', () => {
  it('discovers spec, cases and lifecycle hooks', async () => {
    const result = await KotestAdapter.discover('kotest/CheckoutSpec.kt', context)
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'test_suite', name: 'CheckoutSpec' }),
        expect.objectContaining({
          type: 'test_case',
          name: expect.stringContaining('accepts valid card'),
        }),
        expect.objectContaining({
          type: 'test_fixture',
          metadata: expect.objectContaining({ lifecycle: 'before_each' }),
        }),
      ]),
    )
  })

  it('degrades to a warning when the Kotlin source cannot be loaded', async () => {
    const result = await KotestAdapter.discover('kotest/MissingSpec.kt', context)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'kotest/MissingSpec.kt',
        message: expect.stringContaining('Kotest discovery failed'),
        severity: 'warning',
      }),
    ])
  })
})
