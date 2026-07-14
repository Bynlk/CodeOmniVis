import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ParseContext, ProjectMeta } from '@codeomnivis/shared'
import { DrizzleParser } from '../../src/parsers/drizzle'

const projectRoot = path.resolve(__dirname, '../fixtures/drizzle')
const projectMeta: ProjectMeta = {
  root: projectRoot,
  frontendFramework: 'unknown',
  backendFramework: 'unknown',
  databaseType: 'drizzle',
  monorepoType: 'none',
  frontendDirs: [],
  backendDirs: ['src'],
  trpcRouterPaths: [],
  tsrpcServicePaths: [],
  tsrpcApiDirs: [],
  tsrpcProtocolDirs: [],
  prismaSchemaPath: null,
  typeormEntityDirs: [],
  tsConfigPath: null,
  buildFile: null,
  packages: [],
}
const context: ParseContext = {
  projectRoot,
  projectMeta,
  tsConfig: null,
  pathAliases: {},
}

describe('Drizzle parser contracts', () => {
  it('discovers tables, fields, dialects, and relations', async () => {
    const result = await new DrizzleParser().parse('src/schema.ts', context)

    expect(result.errors).toEqual([])
    expect(result.nodes).toEqual([
      expect.objectContaining({
        type: 'db_model',
        name: 'users',
        metadata: expect.objectContaining({ tableName: 'users', dialect: 'pg', fieldCount: 2 }),
      }),
      expect.objectContaining({
        type: 'db_model',
        name: 'posts',
        metadata: expect.objectContaining({ tableName: 'posts', dialect: 'pg', fieldCount: 2 }),
      }),
    ])
    expect(result.edges).toEqual([
      expect.objectContaining({
        type: 'db_relation',
        confidence: 'certain',
        metadata: expect.objectContaining({ relationType: 'one_to_many' }),
      }),
    ])
  })

  it('degrades a missing source file to one warning', async () => {
    const result = await new DrizzleParser().parse('src/missing/schema.ts', context)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'src/missing/schema.ts',
        severity: 'warning',
        message: expect.stringContaining('Drizzle parser failed'),
      }),
    ])
  })

  it('accepts an empty schema as an empty result', async () => {
    const result = await new DrizzleParser().parse('src/schemas/empty.ts', context)

    expect(result).toEqual({ nodes: [], edges: [], errors: [] })
  })
})
