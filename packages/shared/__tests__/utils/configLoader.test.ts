/**
 * E-11 / F14 回归测试 —— loadConfig 必须对每个嵌套字段做运行时校验,丢弃非法值。
 *
 * 缺陷:旧 mergeWithDefaults 直接 `...partial` 整体展开,任何非法嵌套字段
 * (port: "abc"、frontend.dirs: "src"、非法 framework、parser.maxTraceDepth: -1 等)
 * 都会原样污染下游消费者。修复后非法字段逐一回退默认值 / 丢弃。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadConfig } from '../../src/utils/configLoader'

let projectRoot = ''

function writeConfig(content: string): void {
  fs.writeFileSync(path.join(projectRoot, '.codeomnivis.json'), content, 'utf-8')
}

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-e11-'))
})

afterEach(() => {
  if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('loadConfig 运行时字段校验 (E-11/F14)', () => {
  it('非法标量字段(port / framework)被丢弃并回退默认', () => {
    writeConfig(JSON.stringify({
      port: 'not-a-number',
      frontend: { framework: 'angular' },
      backend: { framework: 'koa' },
    }))

    const config = loadConfig(projectRoot)

    expect(config.port).toBe(4321)
    expect(config.frontend?.framework).toBe('auto')
    expect(config.backend?.framework).toBe('auto')
  })

  it('数组字段中的非字符串项被过滤,非数组回退默认', () => {
    writeConfig(JSON.stringify({
      frontend: { dirs: ['src', 123, null, 'app'] },
      backend: { dirs: 'should-be-array' },
      exclude: ['dist', 42],
    }))

    const config = loadConfig(projectRoot)

    expect(config.frontend?.dirs).toEqual(['src', 'app'])
    expect(config.backend?.dirs).toEqual([])
    expect(config.exclude).toEqual(['dist'])
  })

  it('非法 parser / ui 字段被丢弃,合法字段保留', () => {
    writeConfig(JSON.stringify({
      parser: { maxTraceDepth: -3, incremental: 'yes' },
      ui: { theme: 'neon', layout: 'circle', aggregateThreshold: 0 },
    }))

    const config = loadConfig(projectRoot)

    // maxTraceDepth 非正整数被丢弃;incremental 非布尔被丢弃 → parser 整体无合法字段。
    expect(config.parser).toBeUndefined()
    // theme 非法丢弃,layout 合法保留,aggregateThreshold 非正丢弃。
    expect(config.ui?.theme).toBeUndefined()
    expect(config.ui?.layout).toBe('circle')
    expect(config.ui?.aggregateThreshold).toBeUndefined()
  })

  it('合法配置完整保留', () => {
    writeConfig(JSON.stringify({
      port: 5000,
      frontend: { dirs: ['web'], framework: 'next' },
      backend: { dirs: ['api'], framework: 'express' },
      database: { prismaSchema: 'prisma/schema.prisma', typeormDirs: ['entities'] },
      parser: { maxTraceDepth: 8, incremental: false },
      ui: { theme: 'dark', layout: 'dagre', aggregateThreshold: 200 },
    }))

    const config = loadConfig(projectRoot)

    expect(config.port).toBe(5000)
    expect(config.frontend).toEqual({ dirs: ['web'], framework: 'next' })
    expect(config.backend).toEqual({ dirs: ['api'], framework: 'express' })
    expect(config.database).toEqual({ prismaSchema: 'prisma/schema.prisma', typeormDirs: ['entities'] })
    expect(config.parser).toEqual({ maxTraceDepth: 8, incremental: false })
    expect(config.ui).toEqual({ theme: 'dark', layout: 'dagre', aggregateThreshold: 200 })
  })

  it('完全非法的顶层(数组)回退到默认配置', () => {
    writeConfig(JSON.stringify(['not', 'an', 'object']))

    const config = loadConfig(projectRoot)

    expect(config.port).toBe(4321)
    expect(config.frontend?.framework).toBe('auto')
  })
})
