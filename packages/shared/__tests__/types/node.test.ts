/**
 * 节点类型工具函数测试
 */

import { describe, it, expect } from 'vitest'
import { createNodeId, parseNodeId } from '../../src/types/node'

describe('createNodeId', () => {
  it('生成标准节点 ID', () => {
    expect(createNodeId('page', 'app/page.tsx', '/')).toBe('page:app/page.tsx:/')
    expect(createNodeId('component', 'app/Button.tsx', 'Button')).toBe('component:app/Button.tsx:Button')
    expect(createNodeId('db_model', 'prisma/schema.prisma', 'User')).toBe('db_model:prisma/schema.prisma:User')
  })

  it('处理包含冒号的 name', () => {
    const id = createNodeId('trpc_procedure', 'server/routers/user.ts', 'user:getById')
    expect(id).toBe('trpc_procedure:server/routers/user.ts:user:getById')
  })
})

describe('parseNodeId', () => {
  it('解析标准节点 ID', () => {
    const result = parseNodeId('page:app/page.tsx:/')
    expect(result).toEqual({ type: 'page', filePath: 'app/page.tsx', name: '/' })
  })

  it('解析包含冒号的 name', () => {
    const result = parseNodeId('trpc_procedure:server/routers/user.ts:user:getById')
    expect(result.type).toBe('trpc_procedure')
    expect(result.filePath).toBe('server/routers/user.ts')
    expect(result.name).toBe('user:getById')
  })

  it('无效格式抛出异常', () => {
    expect(() => parseNodeId('invalid')).toThrow('Invalid node ID format')
    expect(() => parseNodeId('a:b')).toThrow('Invalid node ID format')
  })

  it('round-trip: createNodeId → parseNodeId', () => {
    const original = { type: 'page' as const, filePath: 'app/booking/page.tsx', name: '/booking' }
    const id = createNodeId(original.type, original.filePath, original.name)
    const parsed = parseNodeId(id)
    expect(parsed).toEqual(original)
  })
})
