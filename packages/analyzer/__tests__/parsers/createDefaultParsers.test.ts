/**
 * H2 / DUP-01 回归测试 — createDefaultParsers 是解析器集合的单一来源。
 *
 * 缺陷:analyze / check 命令各自手工拼解析器列表,均漏注册 TsRpcParser。
 * 本测试锁定工厂返回的集合包含全部预期解析器(按 name 枚举),
 * 尤其是 tsrpc,防止再次漂移。
 */

import { describe, it, expect } from 'vitest'
import { createDefaultParsers } from '../../src'

describe('H2 DUP-01: createDefaultParsers factory', () => {
  it('returns the full expected parser set including tsrpc', () => {
    const parsers = createDefaultParsers()
    const names = parsers.map((p) => p.name).sort()

    const expected = [
      'prisma',
      'nextjs-app',
      'nextjs-pages',
      'trpc',
      'tsrpc',
      'express',
      'typeorm',
      'api-calls',
      'react-component',
      'nestjs-controller',
      'nestjs-module',
      'nestjs-service',
      'drizzle',
    ].sort()

    expect(names).toEqual(expected)
  })

  it('explicitly includes TsRpcParser (the previously dropped parser)', () => {
    const names = createDefaultParsers().map((p) => p.name)
    expect(names).toContain('tsrpc')
  })

  it('returns fresh instances on each call (no shared mutable state)', () => {
    const a = createDefaultParsers()
    const b = createDefaultParsers()
    expect(a).not.toBe(b)
    expect(a[0]).not.toBe(b[0])
    expect(a.length).toBe(b.length)
  })
})
