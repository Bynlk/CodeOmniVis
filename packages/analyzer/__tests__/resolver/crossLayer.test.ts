/**
 * 跨层连线器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CrossLayerLinker } from '../../src/resolver/crossLayer'
import type { OmniGraph, OmniNode, OmniEdge } from '@codeomnivis/shared'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

describe('CrossLayerLinker', () => {
  let linker: CrossLayerLinker

  beforeEach(() => {
    linker = new CrossLayerLinker()
  })

  describe('link', () => {
    it('should return result with stats', async () => {
      const graph: OmniGraph = { nodes: [], edges: [] }
      const result = await linker.link(graph)

      expect(result).toHaveProperty('edges')
      expect(result).toHaveProperty('stats')
      expect(result.stats.callsApiEdges).toBe(0)
    })

    it('should match tRPC hooks to procedures', async () => {
      const graph: OmniGraph = {
        nodes: [
          {
            id: 'component:src/page.tsx:BookingPage',
            type: 'component',
            name: 'BookingPage',
            filePath: 'src/page.tsx',
            line: 1,
            column: 1,
            metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
          },
          {
            id: 'trpc_procedure:server/routers/booking.ts:list',
            type: 'trpc_procedure',
            name: 'list',
            filePath: 'server/routers/booking.ts',
            line: 5,
            column: 1,
            metadata: {
              procedureType: 'query',
              routerName: 'booking',
              procedureName: 'list',
              hasInput: false,
              hasOutput: false,
            },
          },
        ],
        edges: [
          {
            id: 'temp-calls-api',
            source: 'component:src/page.tsx:BookingPage',
            target: 'trpc_procedure:unknown:booking.list',
            type: 'calls_api',
            confidence: 'certain',
            metadata: {
              callType: 'trpc_hook',
              url: 'booking.list',
              method: 'query',
              callLine: 12,
            },
          },
        ],
      }

      const result = await linker.link(graph)
      // tRPC hook 'booking.list' 应模糊匹配到 routerName=booking/procedureName=list 的 procedure。
      expect(result.stats.callsApiEdges).toBe(1)
      const matched = result.edges.find(e => e.type === 'calls_api')
      expect(matched).toBeTruthy()
      expect(matched?.target).toBe('trpc_procedure:server/routers/booking.ts:list')
      expect(matched?.source).toBe('component:src/page.tsx:BookingPage')
      expect(matched?.confidence).toBe('certain')
    })

    it('matches a tRPC hook by router and procedure when names repeat', async () => {
      const component: OmniNode = {
        id: 'component:components/BookingDetail.tsx:BookingDetail',
        type: 'component',
        name: 'BookingDetail',
        filePath: 'components/BookingDetail.tsx',
        line: 1,
        column: 1,
        metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
      }
      const procedure = (routerName: string, filePath: string): OmniNode => ({
        id: `trpc_procedure:${filePath}:getById`,
        type: 'trpc_procedure',
        name: 'getById',
        filePath,
        line: 5,
        column: 1,
        metadata: {
          procedureType: 'query',
          routerName,
          procedureName: 'getById',
          hasInput: true,
          hasOutput: false,
        },
      })
      const graph: OmniGraph = {
        nodes: [
          component,
          procedure('user', 'server/routers/user.ts'),
          procedure('booking', 'server/routers/booking.ts'),
        ],
        edges: [{
          id: 'booking-get-by-id-call',
          source: component.id,
          target: 'trpc_procedure:unknown:booking.getById',
          type: 'calls_api',
          confidence: 'certain',
          metadata: {
            callType: 'trpc_hook',
            url: 'booking.getById',
            method: 'query',
            callLine: 8,
          },
        }],
      }

      const result = await linker.link(graph)
      const edge = result.edges.find(candidate => candidate.type === 'calls_api')

      expect(edge?.target).toBe('trpc_procedure:server/routers/booking.ts:getById')
    })

    it('does not create resolver handlers for tRPC router declaration containers', async () => {
      const router = {
        id: 'trpc_procedure:server/routers/booking.ts:bookingRouter',
        type: 'trpc_procedure',
        name: 'bookingRouter',
        filePath: 'server/routers/booking.ts',
        line: 1,
        column: 1,
        metadata: {
          procedureType: 'query',
          routerName: 'booking',
          procedureName: 'bookingRouter',
          hasInput: false,
          hasOutput: false,
          isRouter: true,
        },
      } as OmniNode
      const procedure: OmniNode = {
        id: 'trpc_procedure:server/routers/booking.ts:list',
        type: 'trpc_procedure',
        name: 'list',
        filePath: 'server/routers/booking.ts',
        line: 2,
        column: 1,
        metadata: {
          procedureType: 'query',
          routerName: 'booking',
          procedureName: 'list',
          hasInput: false,
          hasOutput: false,
        },
      }
      const graph: OmniGraph = {
        nodes: [router, procedure],
        edges: [{
          id: `${router.id}--contains--${procedure.id}`,
          source: router.id,
          target: procedure.id,
          type: 'contains',
          confidence: 'certain',
          metadata: { routerName: 'booking', procedureName: 'list' },
        }],
      }

      const result = await linker.link(graph)

      expect(result.edges.filter(edge => edge.type === 'handles').map(edge => edge.source))
        .toEqual([procedure.id])
      expect(result.nodes.some(node => node.id.includes('bookingRouter:resolver'))).toBe(false)
    })

    it('should handle empty graph', async () => {
      const graph: OmniGraph = { nodes: [], edges: [] }
      const result = await linker.link(graph)

      expect(result.edges).toHaveLength(0)
    })
  })

  describe('synthetic node persistence (E-08/F6)', () => {
    it('should return synthetic handler nodes in result.nodes for an api_route without a handler', async () => {
      const graph: OmniGraph = {
        nodes: [
          {
            id: 'api_route:src/app/api/booking/route.ts:/api/booking',
            type: 'api_route',
            name: '/api/booking',
            filePath: 'src/app/api/booking/route.ts',
            line: 1,
            column: 1,
            metadata: { method: 'GET', route: '/api/booking', isNextApiRoute: true },
          },
        ],
        edges: [],
      }

      const result = await linker.link(graph)

      // link() 会为缺少 handler 的 api_route 动态创建 synthetic handler 节点,
      // 该节点必须出现在 result.nodes 中,以便上层先落库节点再写边,避免 dangling edge。
      expect(result.nodes.length).toBeGreaterThan(0)
      const syntheticHandler = result.nodes.find(
        n => n.type === 'handler' && n.id === 'handler:src/app/api/booking/route.ts:GET'
      )
      expect(syntheticHandler).toBeTruthy()
      const handlerMetadata = syntheticHandler?.metadata ?? {}
      expect('isSynthetic' in handlerMetadata && handlerMetadata.isSynthetic === true).toBe(true)

      // handles 边的 target 必须能在 result.nodes ∪ graph 既有节点中找到(非 dangling)。
      const handlesEdge = result.edges.find(e => e.type === 'handles')
      expect(handlesEdge).toBeTruthy()
      expect(handlesEdge?.target).toBe('handler:src/app/api/booking/route.ts:GET')
    })

    it('should return empty result.nodes when no synthetic nodes are created', async () => {
      const graph: OmniGraph = { nodes: [], edges: [] }
      const result = await linker.link(graph)

      expect(result.nodes).toHaveLength(0)
    })
  })

  it('resolves relative handler paths against the analyzed project root', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-cross-layer-root-'))
    const handlerFile = path.join(projectRoot, 'backend', 'src', 'api', 'User.ts')
    const serviceFile = path.join(projectRoot, 'backend', 'src', 'api', 'services', 'userService.ts')
    fs.mkdirSync(path.dirname(handlerFile), { recursive: true })
    fs.mkdirSync(path.dirname(serviceFile), { recursive: true })
    fs.writeFileSync(
      handlerFile,
      "import { userService } from './services/userService'\nexport function handler() { return userService() }",
    )
    fs.writeFileSync(serviceFile, 'export function userService() { return true }')

    try {
      const graph: OmniGraph = {
        nodes: [{
          id: 'handler:backend/src/api/User.ts:handler',
          type: 'handler',
          name: 'handler',
          filePath: 'backend/src/api/User.ts',
          line: 2,
          column: 1,
          metadata: { functionName: 'handler', routeId: 'api:user' },
        }],
        edges: [],
      }

      const result = await new CrossLayerLinker(undefined, projectRoot).link(graph)

      expect(result.edges.some(edge => edge.type === 'calls_service')).toBe(true)
      expect(result.nodes.find(node => node.type === 'service')?.filePath)
        .toBe('backend/src/api/services/userService.ts')
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it('links each handler only to the service symbol called inside its own body', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-service-scope-'))
    const routeFile = path.join(projectRoot, 'app', 'api', 'booking', 'route.ts')
    const listService = path.join(projectRoot, 'server', 'services', 'listService.ts')
    const createService = path.join(projectRoot, 'server', 'services', 'createService.ts')
    fs.mkdirSync(path.dirname(routeFile), { recursive: true })
    fs.mkdirSync(path.dirname(listService), { recursive: true })
    fs.writeFileSync(routeFile, [
      "import { listBookings } from '../../../server/services/listService'",
      "import { createBooking } from '../../../server/services/createService'",
      'export function GET() { return listBookings() }',
      'export function POST() { return createBooking() }',
    ].join('\n'))
    fs.writeFileSync(listService, 'export function listBookings() { return [] }')
    fs.writeFileSync(createService, 'export function createBooking() { return {} }')

    try {
      const graph: OmniGraph = {
        nodes: [
          {
            id: 'handler:app/api/booking/route.ts:GET',
            type: 'handler',
            name: 'GET handler',
            filePath: 'app/api/booking/route.ts',
            line: 3,
            column: 1,
            metadata: { functionName: 'GET', routeId: null },
          },
          {
            id: 'handler:app/api/booking/route.ts:POST',
            type: 'handler',
            name: 'POST handler',
            filePath: 'app/api/booking/route.ts',
            line: 4,
            column: 1,
            metadata: { functionName: 'POST', routeId: null },
          },
        ],
        edges: [],
      }

      const result = await new CrossLayerLinker(undefined, projectRoot).link(graph)
      const calls = result.edges.filter(edge => edge.type === 'calls_service')

      expect(calls.map(edge => `${edge.source}->${edge.target}`).sort()).toEqual([
        'handler:app/api/booking/route.ts:GET->service:server/services/listService.ts:listBookings',
        'handler:app/api/booking/route.ts:POST->service:server/services/createService.ts:createBooking',
      ])
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it('isolates DB calls between tRPC procedures declared in the same file', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-trpc-db-scope-'))
    const routerFile = path.join(projectRoot, 'server', 'routers', 'app.ts')
    fs.mkdirSync(path.dirname(routerFile), { recursive: true })
    fs.writeFileSync(routerFile, [
      'export const appRouter = createRouter({',
      '  booking: publicProcedure.query(({ ctx }) => ctx.prisma.booking.findMany()),',
      '  user: publicProcedure.query(({ ctx }) => ctx.prisma.user.findUnique()),',
      '})',
    ].join('\n'))

    const procedure = (name: string, line: number): OmniNode => ({
      id: `trpc_procedure:server/routers/app.ts:${name}`,
      type: 'trpc_procedure',
      name,
      filePath: 'server/routers/app.ts',
      line,
      column: 1,
      metadata: {
        procedureType: 'query',
        routerName: 'app',
        procedureName: name,
        hasInput: false,
        hasOutput: false,
      },
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

    try {
      const result = await new CrossLayerLinker(undefined, projectRoot).link({
        nodes: [procedure('booking', 2), procedure('user', 3), dbModel('Booking'), dbModel('User')],
        edges: [],
      })
      const calls = result.edges.filter(edge => edge.type === 'queries_db')

      expect(calls.map(edge => `${edge.source}->${edge.target}`).sort()).toEqual([
        'handler:server/routers/app.ts:booking:resolver->db_model:prisma/schema.prisma:Booking',
        'handler:server/routers/app.ts:user:resolver->db_model:prisma/schema.prisma:User',
      ])
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  })

})
