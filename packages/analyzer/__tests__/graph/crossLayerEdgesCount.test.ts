/**
 * E-09 / F17 回归测试 —— runFullAnalysis 必须返回真实跨层连线数。
 *
 * 缺陷:runFullAnalysis 实际计算并落库 cross-layer edges(synthetic handler
 * 的 handles 边、calls_api 边等),但返回值里 crossLayerEdges 被硬编码为 0,
 * 导致 CLI/MCP/监控读到的跨层连线计数永远为 0,报告误导。
 *
 * 用一个最小 Next.js 项目(含一个无 handler 的 api route)跑 runFullAnalysis:
 * CrossLayerLinker 会为该 api_route 合成 handler 节点并产出 'handles' 跨层边,
 * 因此 crossLayerEdges 必须 > 0,且与已落库的跨层边规模一致。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runFullAnalysis } from '../../src/graph/runFullAnalysis'
import { OmniDatabase } from '../../src/storage/db'

const PKG_JSON = JSON.stringify({
  name: 'fixture-next',
  dependencies: { next: '14.0.0', react: '18.0.0' },
})

const API_ROUTE = `export async function GET() {
  return Response.json({ ok: true })
}
`

describe('runFullAnalysis crossLayerEdges 计数 (E-09/F17)', () => {
  let projectRoot: string
  let dbPath: string

  beforeAll(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-xledge-'))
    fs.writeFileSync(path.join(projectRoot, 'package.json'), PKG_JSON)
    const apiDir = path.join(projectRoot, 'app', 'api', 'booking')
    fs.mkdirSync(apiDir, { recursive: true })
    fs.writeFileSync(path.join(apiDir, 'route.ts'), API_ROUTE)
    dbPath = path.join(projectRoot, 'graph.db')
  })

  afterAll(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('返回的 crossLayerEdges 反映真实跨层连线数(非硬编码 0)', async () => {
    const result = await runFullAnalysis({ projectRoot, dbPath })

    // 该 fixture 必然产出 synthetic handler 的 handles 跨层边
    expect(result.crossLayerEdges).toBeGreaterThan(0)

    // 与落库的 synthetic handler 节点规模一致性校验
    const db = new OmniDatabase(dbPath)
    await db.ready()
    try {
      const handlers = db.getNodesByType('handler')
      const synthetic = handlers.filter(n => {
        const m = n.metadata ?? {}
        return 'isSynthetic' in m && m.isSynthetic === true
      })
      // 至少有一个 synthetic handler,对应至少一条 handles 跨层边
      expect(synthetic.length).toBeGreaterThan(0)
      expect(result.crossLayerEdges).toBeGreaterThanOrEqual(synthetic.length)
    } finally {
      db.close()
    }
  })
})
