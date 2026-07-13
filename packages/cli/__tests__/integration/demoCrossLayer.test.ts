import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { OmniDatabase, runAnalysis } from '@codeomnivis/analyzer'
import type { EdgeType, OmniEdge } from '@codeomnivis/shared'
import { autoDetectProject } from '../../src/utils/autoDetect'

const DEMO_ROOT = fileURLToPath(new URL('../../../../demo', import.meta.url))

function hasEdge(edges: OmniEdge[], source: string, type: EdgeType, target: string): boolean {
  return edges.some(edge => edge.source === source && edge.type === type && edge.target === target)
}

describe('official demo cross-layer paths', () => {
  it('builds exact REST and tRPC paths with stable graph identities', async () => {
    const db = new OmniDatabase(':memory:')
    await db.ready()
    const projectMeta = await autoDetectProject(DEMO_ROOT)

    try {
      await runAnalysis({ projectRoot: DEMO_ROOT, dbPath: ':memory:', db, projectMeta })
      const firstNodes = db.getAllNodes()
      const firstEdges = db.getAllEdges()

      expect(hasEdge(
        firstEdges,
        'component:components/BookingList.tsx:BookingList',
        'calls_api',
        'api_route:app/api/booking/route.ts:/api/booking',
      )).toBe(true)
      expect(hasEdge(
        firstEdges,
        'page:app/booking/page.tsx:/booking',
        'renders',
        'component:app/booking/page.tsx:BookingPage',
      )).toBe(true)
      expect(hasEdge(
        firstEdges,
        'page:app/booking/page.tsx:/booking',
        'renders',
        'component:components/BookingList.tsx:BookingList',
      )).toBe(false)
      expect(hasEdge(
        firstEdges,
        'api_route:app/api/booking/route.ts:/api/booking',
        'handles',
        'handler:app/api/booking/route.ts:GET',
      )).toBe(true)
      expect(hasEdge(
        firstEdges,
        'handler:app/api/booking/route.ts:GET',
        'calls_service',
        'service:server/services/bookingService.ts:listBookings',
      )).toBe(true)
      expect(hasEdge(
        firstEdges,
        'service:server/services/bookingService.ts:listBookings',
        'queries_db',
        'db_model:schema.prisma:Booking',
      )).toBe(true)
      expect(firstEdges
        .filter(edge => edge.source === 'handler:app/api/booking/route.ts:POST'
          && edge.type === 'calls_service')
        .map(edge => edge.target)
        .sort(),
      ).toEqual(['service:server/services/bookingService.ts:createBooking'])
      expect(firstEdges.some(edge =>
        ['handler:app/api/booking/route.ts:GET', 'handler:app/api/booking/route.ts:POST']
          .includes(edge.source)
        && edge.type === 'queries_db',
      )).toBe(false)
      expect(firstNodes.some(node =>
        node.type === 'handler' && node.name.endsWith('Router resolver'),
      )).toBe(false)

      expect(hasEdge(
        firstEdges,
        'component:components/BookingDetail.tsx:BookingDetail',
        'calls_api',
        'trpc_procedure:server/routers/booking.ts:getById',
      )).toBe(true)
      expect(hasEdge(
        firstEdges,
        'trpc_procedure:server/routers/booking.ts:getById',
        'handles',
        'handler:server/routers/booking.ts:getById:resolver',
      )).toBe(true)
      expect(hasEdge(
        firstEdges,
        'handler:server/routers/booking.ts:getById:resolver',
        'queries_db',
        'db_model:schema.prisma:Booking',
      )).toBe(true)

      const nodeIds = new Set(firstNodes.map(node => node.id))
      expect(firstEdges.every(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true)
      expect(firstEdges.some(edge => edge.target.includes(':unknown:'))).toBe(false)
      for (const type of ['calls_api', 'handles', 'calls_service', 'queries_db'] as const) {
        expect(firstEdges.some(edge => edge.type === type)).toBe(true)
      }

      const firstNodeIds = firstNodes.map(node => node.id).sort()
      const firstEdgeIds = firstEdges.map(edge => edge.id).sort()
      await runAnalysis({ projectRoot: DEMO_ROOT, dbPath: ':memory:', db, projectMeta })
      expect(db.getAllNodes().map(node => node.id).sort()).toEqual(firstNodeIds)
      expect(db.getAllEdges().map(edge => edge.id).sort()).toEqual(firstEdgeIds)
    } finally {
      db.close()
    }
  }, 30_000)
})
