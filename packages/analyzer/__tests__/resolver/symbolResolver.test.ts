import { describe, it, expect, beforeAll } from 'vitest'
import { SymbolResolver } from '../../src/resolver/symbolResolver'
import * as path from 'path'

// 使用 demo 项目作为测试目标
const DEMO_TSCONFIG = path.resolve(__dirname, '../../../../demo/tsconfig.json')
const DEMO_ROUTE = path.resolve(__dirname, '../../../../demo/app/api/booking/route.ts')

describe('SymbolResolver', () => {
  let resolver: SymbolResolver

  beforeAll(() => {
    resolver = new SymbolResolver(DEMO_TSCONFIG)
  })

  it('should find Prisma calls in a Next.js route handler', async () => {
    const handlerNode = {
      id: 'handler:demo/app/api/booking/route.ts:POST',
      type: 'handler' as const,
      name: 'POST handler',
      filePath: DEMO_ROUTE,
      line: 9,
      column: 0,
      metadata: {},
    }

    const result = await resolver.traceHandlerToDb(handlerNode)

    expect(result.dbCalls.length).toBeGreaterThan(0)
    expect(result.dbCalls[0].modelName).toBe('Booking')
    expect(['create', 'findMany', 'findFirst']).toContain(result.dbCalls[0].operation)
  })

  it('should find Prisma calls in GET handler', async () => {
    const handlerNode = {
      id: 'handler:demo/app/api/booking/route.ts:GET',
      type: 'handler' as const,
      name: 'GET handler',
      filePath: DEMO_ROUTE,
      line: 4,
      column: 0,
      metadata: {},
    }

    const result = await resolver.traceHandlerToDb(handlerNode)

    expect(result.dbCalls.length).toBeGreaterThan(0)
    expect(result.dbCalls[0].modelName).toBe('Booking')
    expect(result.dbCalls[0].operation).toBe('findMany')
  })

  it('should not crash on files with no DB calls', async () => {
    const uiNode = {
      id: 'handler:demo/components/Hero.tsx:Hero',
      type: 'handler' as const,
      name: 'Hero',
      filePath: path.resolve(__dirname, '../../../../demo/components/Hero.tsx'),
      line: 1,
      column: 0,
      metadata: {},
    }

    const result = await resolver.traceHandlerToDb(uiNode)
    expect(result.dbCalls).toHaveLength(0)
  })

  it('should return error for non-existent file', async () => {
    const fakeNode = {
      id: 'handler:nonexistent.ts:POST',
      type: 'handler' as const,
      name: 'POST',
      filePath: '/nonexistent/file.ts',
      line: 1,
      column: 0,
      metadata: {},
    }

    const result = await resolver.traceHandlerToDb(fakeNode)
    expect(result.dbCalls).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should use cache for repeated calls', async () => {
    const handlerNode = {
      id: 'handler:demo/app/api/booking/route.ts:POST',
      type: 'handler' as const,
      name: 'POST handler',
      filePath: DEMO_ROUTE,
      line: 9,
      column: 0,
      metadata: {},
    }

    const result1 = await resolver.traceHandlerToDb(handlerNode)
    const result2 = await resolver.traceHandlerToDb(handlerNode)

    // 第二次应返回缓存结果
    expect(result1).toEqual(result2)
  })
})
