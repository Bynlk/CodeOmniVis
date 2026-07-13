import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { OmniNode } from '@codeomnivis/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { DbCallResolver } from '../../src/resolver/dbCallResolver'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('DbCallResolver', () => {
  it('uses a scoped fallback when symbol tracing returns no DB calls', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-db-resolver-'))
    temporaryRoots.push(projectRoot)
    const routerFile = path.join(projectRoot, 'server', 'routers', 'app.ts')
    fs.mkdirSync(path.dirname(routerFile), { recursive: true })
    fs.writeFileSync(routerFile, [
      'export const appRouter = createRouter({',
      '  booking: publicProcedure.query(({ ctx }) => ctx.prisma.booking.findMany()),',
      '  user: publicProcedure.query(({ ctx }) => ctx.prisma.user.findUnique()),',
      '})',
    ].join('\n'))

    const handler = (name: string, line: number): OmniNode => ({
      id: `handler:server/routers/app.ts:${name}:resolver`,
      type: 'handler',
      name: `${name} resolver`,
      filePath: 'server/routers/app.ts',
      line,
      column: 1,
      metadata: { functionName: name, routeId: `trpc:${name}`, isSynthetic: true },
    })
    const dbModel = (name: string): OmniNode => ({
      id: `db_model:prisma/schema.prisma:${name}`,
      type: 'db_model',
      name,
      filePath: 'prisma/schema.prisma',
      line: 1,
      column: 1,
      metadata: { tableName: name, fieldCount: 0, fields: [] },
    })
    const symbolResolver = {
      traceHandlerToDb: async () => ({ dbCalls: [], callChain: [], errors: [] }),
    }
    const resolver = new DbCallResolver(projectRoot, undefined, symbolResolver)
    const models = [dbModel('Booking'), dbModel('User')]

    const booking = await resolver.resolve(handler('booking', 2), models, 2)
    const user = await resolver.resolve(handler('user', 3), models, 2)

    expect(booking.dbEdges.map(edge => edge.target)).toEqual([
      'db_model:prisma/schema.prisma:Booking',
    ])
    expect(user.dbEdges.map(edge => edge.target)).toEqual([
      'db_model:prisma/schema.prisma:User',
    ])
  })

  it('attributes traced DB calls to the service that owns the call site', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-db-owner-'))
    temporaryRoots.push(projectRoot)
    const serviceFile = path.join(projectRoot, 'server', 'services', 'bookingService.ts')
    fs.mkdirSync(path.dirname(serviceFile), { recursive: true })
    fs.writeFileSync(serviceFile, 'export function listBookings() { return prisma.booking.findMany() }')

    const caller: OmniNode = {
      id: 'handler:app/api/booking/route.ts:GET',
      type: 'handler',
      name: 'GET handler',
      filePath: 'app/api/booking/route.ts',
      line: 1,
      column: 1,
      metadata: { functionName: 'GET', routeId: null },
    }
    const booking: OmniNode = {
      id: 'db_model:schema.prisma:Booking',
      type: 'db_model',
      name: 'Booking',
      filePath: 'schema.prisma',
      line: 1,
      column: 1,
      metadata: { tableName: 'Booking', fieldCount: 0, fields: [] },
    }
    const symbolResolver = {
      traceHandlerToDb: async () => ({
        dbCalls: [{
          modelName: 'Booking',
          operation: 'findMany',
          filePath: serviceFile,
          line: 1,
          confidence: 'certain' as const,
          ownerId: `service:${serviceFile}:listBookings`,
        }],
        callChain: [caller.id, `service:${serviceFile}:listBookings`],
        errors: [],
      }),
    }

    const result = await new DbCallResolver(projectRoot, undefined, symbolResolver)
      .resolve(caller, [booking], 1)

    expect(result.dbEdges.map(edge => edge.source)).toEqual([
      'service:server/services/bookingService.ts:listBookings',
    ])
    expect(result.serviceEdges.map(edge => [edge.source, edge.target])).toEqual([[
      caller.id,
      'service:server/services/bookingService.ts:listBookings',
    ]])
  })
})
