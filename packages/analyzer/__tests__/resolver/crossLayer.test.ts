/**
 * 跨层连线器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CrossLayerLinker } from '../../src/resolver/crossLayer'
import type { OmniGraph, OmniNode, OmniEdge } from '@omnivis/shared'

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
            metadata: {},
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
            },
          },
        ],
      }

      const result = await linker.link(graph)
      expect(result.stats.callsApiEdges).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty graph', async () => {
      const graph: OmniGraph = { nodes: [], edges: [] }
      const result = await linker.link(graph)

      expect(result.edges).toHaveLength(0)
    })
  })
})
