/**
 * H1 / RACE-01 回归测试 — 分析结果必须到得了查询层。
 *
 * 缺陷:runAnalysis 内部新建独立 :memory: OmniDatabase,与 server 查询用的
 * db 不是同一实例;分析写入后查询端永远读不到。
 *
 * 本测试使用真实 runAnalysis(不 mock):在临时项目里放一份 prisma schema,
 * 触发一次分析后,通过 server 的 GET /api/graph 必须能读到刚写入的节点。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import { codeomnivisEvents } from '../../src/events'
import { createOmniServer } from '../../src/index'

const PRISMA_SCHEMA = `// 测试用的 Prisma Schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Profile {
  id     String  @id @default(cuid())
  bio    String?
  user   User    @relation(fields: [userId], references: [id])
  userId String  @unique
}

model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}
`

describe('H1 RACE-01: analysis results reach the query layer (shared DB)', () => {
  let server: ReturnType<typeof createOmniServer>
  let projectRoot: string

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-shareddb-'))
    fs.mkdirSync(path.join(projectRoot, 'prisma'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, 'prisma', 'schema.prisma'), PRISMA_SCHEMA, 'utf-8')
    server = createOmniServer({ projectRoot, dbPath: ':memory:' })
    await server.db.ready()
  })

  afterEach(async () => {
    await server.stop()
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('exposes analyzed nodes through GET /api/graph after a manual analyze', async () => {
    // 触发一次分析(REST 兜底入口,内部走 incrementalAnalyzer.refresh -> runAnalysis)
    const analyzeRes = await request(server.app).post('/api/analyze').send({})
    expect(analyzeRes.status).toBe(200)
    expect(analyzeRes.body.data.success).toBe(true)

    // 通过 server 查询接口读取图:修复前为 0(数据写进了另一个 db),修复后 > 0
    const graphRes = await request(server.app).get('/api/graph')
    expect(graphRes.status).toBe(200)
    expect(graphRes.body.meta.nodeCount).toBeGreaterThan(0)

    // 与分析产出一致:至少包含 prisma 解析出的 db_model 节点
    const nodes: Array<{ type: string }> = graphRes.body.data.nodes
    expect(nodes.some((n) => n.type === 'db_model')).toBe(true)
  }, 30_000)

  it('reads the same DB instance the analyzer wrote to (no separate handle)', async () => {
    await request(server.app).post('/api/analyze').send({})
    // server.db 与分析写入的是同一实例:直接 loadGraph 也应能看到节点
    const graph = server.db.loadGraph()
    expect(graph.nodes.length).toBeGreaterThan(0)
  }, 30_000)
})
