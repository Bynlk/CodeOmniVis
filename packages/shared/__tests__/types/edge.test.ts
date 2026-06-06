/**
 * 边类型工具函数测试
 */

import { describe, it, expect } from 'vitest'
import { createEdgeId, parseEdgeId } from '../../src/types/edge'

describe('createEdgeId', () => {
  it('生成标准边 ID', () => {
    const id = createEdgeId('page:app/page.tsx:/', 'renders', 'component:app/Button.tsx:Button')
    expect(id).toBe('page:app/page.tsx:/--renders--component:app/Button.tsx:Button')
  })

  it('处理所有边类型', () => {
    const types = ['renders', 'navigates_to', 'calls_api', 'handles', 'calls_service', 'queries_db', 'db_relation', 'imports', 'contains'] as const
    for (const type of types) {
      const id = createEdgeId('src', type, 'tgt')
      expect(id).toContain(`--${type}--`)
    }
  })
})

describe('parseEdgeId', () => {
  it('解析标准边 ID', () => {
    const result = parseEdgeId('page:app/page.tsx:/--renders--component:app/Button.tsx:Button')
    expect(result.source).toBe('page:app/page.tsx:/')
    expect(result.type).toBe('renders')
    expect(result.target).toBe('component:app/Button.tsx:Button')
  })

  it('无效格式抛出异常', () => {
    expect(() => parseEdgeId('invalid')).toThrow('Invalid edge ID format')
    expect(() => parseEdgeId('a--b')).toThrow('Invalid edge ID format')
  })

  it('round-trip: createEdgeId → parseEdgeId', () => {
    const source = 'page:app/page.tsx:/'
    const target = 'component:app/Button.tsx:Button'
    const type = 'renders' as const
    const id = createEdgeId(source, type, target)
    const parsed = parseEdgeId(id)
    expect(parsed).toEqual({ source, type, target })
  })
})
