import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ParseContext, ProjectMeta } from '@codeomnivis/shared'
import {
  NestjsControllerParser,
  NestjsModuleParser,
  NestjsServiceParser,
} from '../../src/parsers/nestjs'

const projectRoot = path.resolve(__dirname, '../fixtures/nestjs')
const projectMeta: ProjectMeta = {
  root: projectRoot,
  frontendFramework: 'unknown',
  backendFramework: 'nestjs',
  databaseType: 'unknown',
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

describe('NestJS parser contracts', () => {
  it('discovers controller routes, a module, and an injectable service', async () => {
    const controller = await new NestjsControllerParser().parse('src/orders.controller.ts', context)
    const module = await new NestjsModuleParser().parse('src/orders.module.ts', context)
    const service = await new NestjsServiceParser().parse('src/orders.service.ts', context)

    expect(controller.errors).toEqual([])
    expect(controller.nodes.map(node => node.name)).toEqual([
      'GET api/orders/:id',
      'findOne',
      'POST api/orders',
      'create',
    ])
    expect(controller.edges).toHaveLength(2)
    expect(module.nodes).toEqual([
      expect.objectContaining({ type: 'module', name: 'OrdersModule' }),
    ])
    expect(service.nodes).toEqual([
      expect.objectContaining({ type: 'service', name: 'OrdersService' }),
    ])
  })

  it('degrades a missing source file to one warning', async () => {
    const result = await new NestjsControllerParser().parse('src/missing.controller.ts', context)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.errors).toEqual([
      expect.objectContaining({
        file: 'src/missing.controller.ts',
        severity: 'warning',
        message: expect.stringContaining('NestJS controller parser failed'),
      }),
    ])
  })

  it('accepts an empty matching file as an empty result', async () => {
    const result = await new NestjsModuleParser().parse('src/empty.module.ts', context)

    expect(result).toEqual({ nodes: [], edges: [], errors: [] })
  })
})
