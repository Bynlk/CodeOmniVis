/**
 * autoDetectProject 测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { autoDetectProject } from '../../src/utils/autoDetect'

describe('autoDetectProject', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnivis-detect-'))
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('检测 next + trpc + prisma 项目', async () => {
    // 创建 package.json
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          next: '14.0.0',
          '@trpc/server': '10.0.0',
          '@prisma/client': '5.0.0',
        },
      })
    )

    // 创建 prisma schema
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir)
    fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), 'model User {}')

    const meta = await autoDetectProject(tmpDir)

    expect(meta.frontendFramework).toBe('next')
    expect(meta.backendFramework).toBe('trpc')
    expect(meta.databaseType).toBe('prisma')
    expect(meta.prismaSchemaPath).toBe('prisma/schema.prisma')
  })

  it('补全 trpcRouterPaths', async () => {
    // 创建 tRPC router 目录
    const routerDir = path.join(tmpDir, 'server', 'routers')
    fs.mkdirSync(routerDir, { recursive: true })
    fs.writeFileSync(path.join(routerDir, 'user.ts'), 'export {}')
    fs.writeFileSync(path.join(routerDir, 'post.tsx'), 'export {}')

    const meta = await autoDetectProject(tmpDir)

    expect(meta.trpcRouterPaths.length).toBeGreaterThanOrEqual(2)
    // findTrpcRouterPaths 使用 path.join，Windows 下返回反斜杠
    const expected = path.join('server', 'routers', 'user.ts')
    expect(meta.trpcRouterPaths).toContain(expected)
  })

  it('补全 typeormEntityDirs', async () => {
    // 清理之前的 prisma schema，避免影响检测逻辑
    const prismaDir = path.join(tmpDir, 'prisma')
    if (fs.existsSync(prismaDir)) {
      fs.rmSync(prismaDir, { recursive: true, force: true })
    }

    // 重写 package.json 为 typeorm 项目
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: {
          typeorm: '0.3.0',
        },
      })
    )

    // 创建 entity 目录
    const entityDir = path.join(tmpDir, 'src', 'entity')
    fs.mkdirSync(entityDir, { recursive: true })
    fs.writeFileSync(path.join(entityDir, 'User.ts'), 'export {}')

    const meta = await autoDetectProject(tmpDir)

    expect(meta.databaseType).toBe('typeorm')
    expect(meta.typeormEntityDirs).toContain('src/entity')
  })
})
