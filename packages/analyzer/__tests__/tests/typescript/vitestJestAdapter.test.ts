import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { VitestJestAdapter } from '../../../src/tests/typescript/vitestJestAdapter'
import type { TestDiscoveryContext } from '../../../src/tests'

const fixtureRoot = path.resolve(__dirname, '../../fixtures/tests/typescript')

function context(): TestDiscoveryContext {
  return {
    projectRoot: fixtureRoot,
    projectMeta: {
      root: fixtureRoot, frontendFramework: 'unknown', backendFramework: 'unknown',
      databaseType: 'unknown', monorepoType: 'none', frontendDirs: [], backendDirs: [],
      trpcRouterPaths: [], tsrpcServicePaths: [], tsrpcApiDirs: [], tsrpcProtocolDirs: [],
      prismaSchemaPath: null, typeormEntityDirs: [], tsConfigPath: null, buildFile: null, packages: [],
    },
    tsConfig: null, pathAliases: {}, knownProductionNodes: [],
  }
}

describe('VitestJestAdapter', () => {
  it('discovers nested Vitest suites, skipped and parameterized cases, and fixtures', async () => {
    const result = await VitestJestAdapter.discover('vitest/checkout.fixture.ts', context())
    const cases = result.nodes.filter(node => node.type === 'test_case')

    expect(result.nodes.some(node => node.name === 'checkout > cards')).toBe(true)
    expect(cases).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'checkout > cards > rejects expired card', metadata: expect.objectContaining({ disabled: true }) }),
      expect.objectContaining({ name: 'checkout > cards > accepts %s', metadata: expect.objectContaining({ isParameterized: true }) }),
    ]))
    expect(result.nodes.some(node => node.type === 'test_fixture' && node.metadata.lifecycle === 'before_each')).toBe(true)
    expect(result.edges.some(edge => edge.type === 'tests')).toBe(true)
  })

  it('selects Jest from import evidence', async () => {
    const result = await VitestJestAdapter.discover('jest/order.fixture.ts', context())
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'test_case', metadata: expect.objectContaining({ framework: 'jest' }) }),
      expect.objectContaining({ type: 'test_fixture', metadata: expect.objectContaining({ lifecycle: 'after_all' }) }),
    ]))
  })
})
