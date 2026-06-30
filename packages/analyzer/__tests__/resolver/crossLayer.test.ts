/**
 * 跨层连线器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CrossLayerLinker } from '../../src/resolver/crossLayer'
import type { OmniGraph, OmniNode, OmniEdge } from '@codeomnivis/shared'

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

})
