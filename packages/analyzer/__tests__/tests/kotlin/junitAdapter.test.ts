import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { JunitAdapter } from '../../../src/tests/kotlin/junitAdapter'
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

describe('JunitAdapter', () => {
  it('discovers JUnit 5 classes, lifecycle and parameter source', async () => {
    const result = await JunitAdapter.discover('junit5/CheckoutTest.kt', context)
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'test_suite', name: 'CheckoutTest' }),
        expect.objectContaining({
          type: 'test_case',
          name: expect.stringContaining('rejectsExpiredCard'),
          metadata: expect.objectContaining({
            isParameterized: true,
            parameterSource: 'expiredCards',
          }),
        }),
        expect.objectContaining({
          type: 'test_fixture',
          metadata: expect.objectContaining({ lifecycle: 'before_each' }),
        }),
      ]),
    )
    expect(
      result.edges.every(
        (edge) =>
          result.nodes.some((node) => node.id === edge.source) &&
          result.nodes.some((node) => node.id === edge.target),
      ),
    ).toBe(true)
  })

  it('degrades to a warning when the Kotlin source cannot be loaded', async () => {
    const result = await JunitAdapter.discover('junit5/MissingTest.kt', context)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'junit5/MissingTest.kt',
        message: expect.stringContaining('JUnit discovery failed'),
        severity: 'warning',
      }),
    ])
  })
})
