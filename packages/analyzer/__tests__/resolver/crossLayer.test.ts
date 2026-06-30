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
})
