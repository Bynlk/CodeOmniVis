import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PlaywrightAdapter } from '../../../src/tests/typescript/playwrightAdapter'
import type { TestDiscoveryContext } from '../../../src/tests'

const root = path.resolve(__dirname, '../../fixtures/tests/typescript')
const context: TestDiscoveryContext = {
  projectRoot: root,
  projectMeta: { root, frontendFramework: 'unknown', backendFramework: 'unknown', databaseType: 'unknown', monorepoType: 'none', frontendDirs: [], backendDirs: [], trpcRouterPaths: [], tsrpcServicePaths: [], tsrpcApiDirs: [], tsrpcProtocolDirs: [], prismaSchemaPath: null, typeormEntityDirs: [], tsConfigPath: null, buildFile: null, packages: [] },
  tsConfig: null, pathAliases: {}, knownProductionNodes: [],
}

describe('PlaywrightAdapter', () => {
  it('discovers browser cases, fixtures and route evidence', async () => {
    const result = await PlaywrightAdapter.discover('playwright/browser.fixture.ts', context)
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'test_case', metadata: expect.objectContaining({ framework: 'playwright', disabled: true }) }),
      expect.objectContaining({ type: 'test_fixture', name: expect.stringContaining('account') }),
    ]))
    expect(result.edges.some(edge => edge.type === 'uses_fixture' && edge.metadata.usage === 'parameter')).toBe(true)
  })
})
