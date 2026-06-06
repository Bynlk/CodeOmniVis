/**
 * 常量完整性测试
 */

import { describe, it, expect } from 'vitest'
import { NODE_COLORS, NODE_COLORS_ALPHA, NODE_ICONS } from '../../src/constants/nodeColors'
import {
  DEFAULT_PORT,
  DEFAULT_MAX_TRACE_DEPTH,
  DEFAULT_AGGREGATE_THRESHOLD,
  MODULE_FOLD_THRESHOLD,
  DEFAULT_EXCLUDE,
  FILE_PATTERNS,
} from '../../src/constants/defaults'
import type { NodeType } from '../../src/types/node'

const ALL_NODE_TYPES: NodeType[] = [
  'page', 'component', 'api_route', 'trpc_procedure',
  'express_route', 'handler', 'service', 'db_model', 'module',
]

describe('NODE_COLORS', () => {
  it('包含所有 NodeType 的颜色', () => {
    for (const type of ALL_NODE_TYPES) {
      expect(NODE_COLORS[type]).toBeDefined()
      expect(NODE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('NODE_COLORS_ALPHA', () => {
  it('包含所有 NodeType 的半透明颜色', () => {
    for (const type of ALL_NODE_TYPES) {
      expect(NODE_COLORS_ALPHA[type]).toBeDefined()
      expect(NODE_COLORS_ALPHA[type]).toMatch(/^#[0-9a-f]{6}40$/)
    }
  })
})

describe('NODE_ICONS', () => {
  it('包含所有 NodeType 的图标', () => {
    for (const type of ALL_NODE_TYPES) {
      expect(NODE_ICONS[type]).toBeDefined()
      expect(typeof NODE_ICONS[type]).toBe('string')
    }
  })
})

describe('默认配置常量', () => {
  it('DEFAULT_PORT 是正整数', () => {
    expect(DEFAULT_PORT).toBe(4321)
  })

  it('DEFAULT_MAX_TRACE_DEPTH 是正整数', () => {
    expect(DEFAULT_MAX_TRACE_DEPTH).toBeGreaterThan(0)
  })

  it('DEFAULT_AGGREGATE_THRESHOLD 是正整数', () => {
    expect(DEFAULT_AGGREGATE_THRESHOLD).toBeGreaterThan(0)
  })

  it('MODULE_FOLD_THRESHOLD 是正整数', () => {
    expect(MODULE_FOLD_THRESHOLD).toBeGreaterThan(0)
  })

  it('DEFAULT_EXCLUDE 包含常见排除目录', () => {
    expect(DEFAULT_EXCLUDE).toContain('node_modules')
    expect(DEFAULT_EXCLUDE).toContain('dist')
    expect(DEFAULT_EXCLUDE).toContain('.next')
    expect(DEFAULT_EXCLUDE).toContain('.git')
  })
})

describe('FILE_PATTERNS', () => {
  it('prismaSchema 匹配 schema.prisma', () => {
    expect(FILE_PATTERNS.prismaSchema.test('prisma/schema.prisma')).toBe(true)
    expect(FILE_PATTERNS.prismaSchema.test('schema.prisma')).toBe(true)
    expect(FILE_PATTERNS.prismaSchema.test('prisma/schema.ts')).toBe(false)
  })

  it('nextjsPage 匹配 app router 页面', () => {
    expect(FILE_PATTERNS.nextjsPage.test('app/booking/page.tsx')).toBe(true)
    expect(FILE_PATTERNS.nextjsPage.test('app/dashboard/settings/page.tsx')).toBe(true)
    expect(FILE_PATTERNS.nextjsPage.test('app/api/route.ts')).toBe(false)
    expect(FILE_PATTERNS.nextjsPage.test('pages/index.tsx')).toBe(false)
  })

  it('nextjsApiRoute 匹配 app router API 路由', () => {
    expect(FILE_PATTERNS.nextjsApiRoute.test('app/api/route.ts')).toBe(true)
    expect(FILE_PATTERNS.nextjsApiRoute.test('app/api/booking/route.ts')).toBe(true)
    expect(FILE_PATTERNS.nextjsApiRoute.test('app/page.tsx')).toBe(false)
  })

  it('reactComponent 匹配 tsx/jsx 文件', () => {
    expect(FILE_PATTERNS.reactComponent.test('App.tsx')).toBe(true)
    expect(FILE_PATTERNS.reactComponent.test('Button.jsx')).toBe(true)
    expect(FILE_PATTERNS.reactComponent.test('utils.ts')).toBe(false)
  })
})
