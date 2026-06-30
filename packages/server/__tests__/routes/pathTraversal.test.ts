/**
 * H3 · S-01 路径穿越防护测试。
 *
 * /api/project 切换项目根时,入参路径必须规整并约束在配置边界内。
 * 越界(../ 穿越、绝对路径越界、符号化 .. 组合)一律 400 且不触发分析(不读盘/不切换);
 * 合法子路径正常切换。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import request from 'supertest'
import { codeomnivisEvents } from '../../src/events'

vi.mock('@codeomnivis/analyzer', async () => {
  const actual = await vi.importActual<typeof import('@codeomnivis/analyzer')>('@codeomnivis/analyzer')
  return { ...actual, runAnalysis: vi.fn() }
})

const analyzerModule = await import('@codeomnivis/analyzer')
const runAnalysisMock = vi.mocked(analyzerModule.runAnalysis)
const { createOmniServer } = await import('../../src/index')

describe('POST /api/project — path traversal guard', () => {
  let server: ReturnType<typeof createOmniServer>
  let baseRoot: string
  let subRoot: string

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    runAnalysisMock.mockReset()
    runAnalysisMock.mockResolvedValue({
      filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
    })
    baseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-pt-'))
    subRoot = path.join(baseRoot, 'packages', 'app')
    fs.mkdirSync(subRoot, { recursive: true })
    server = createOmniServer({ projectRoot: baseRoot, dbPath: ':memory:' })
    await server.db.ready()
  })

  afterEach(() => {
    fs.rmSync(baseRoot, { recursive: true, force: true })
  })

  it('rejects ../ traversal with 400 and does not trigger analysis', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: '../../etc/passwd' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('PATH_TRAVERSAL')
    expect(runAnalysisMock).not.toHaveBeenCalled()
  })

  it('rejects an absolute out-of-boundary path with 400', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-out-'))
    try {
      const res = await request(server.app)
        .post('/api/project')
        .send({ projectRoot: outside })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('PATH_TRAVERSAL')
      expect(runAnalysisMock).not.toHaveBeenCalled()
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  it('rejects a symbolic .. combination that escapes the boundary with 400', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: path.join('packages', '..', '..', '..', 'etc') })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('PATH_TRAVERSAL')
    expect(runAnalysisMock).not.toHaveBeenCalled()
  })

  it('accepts a legitimate sub-path and triggers analysis', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: subRoot })
    expect(res.status).toBe(200)
    expect(res.body.data.projectRoot).toBe(path.resolve(subRoot))
    expect(runAnalysisMock).toHaveBeenCalled()
  })

  it('accepts a relative sub-path resolved against the boundary', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: path.join('packages', 'app') })
    expect(res.status).toBe(200)
    expect(res.body.data.projectRoot).toBe(path.resolve(subRoot))
    expect(runAnalysisMock).toHaveBeenCalled()
  })
})
