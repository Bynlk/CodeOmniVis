/**
 * POST /api/project 运行时切换项目根目录路由测试。
 *
 * mock runAnalysis 避免真实扫描;验证输入校验、目录校验与成功切换。
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

describe('POST /api/project', () => {
  let server: ReturnType<typeof createOmniServer>
  let baseRoot: string
  let targetRoot: string

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    runAnalysisMock.mockReset()
    runAnalysisMock.mockResolvedValue({
      filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
    })
    baseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-base-'))
    targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-target-'))
    server = createOmniServer({ projectRoot: baseRoot, dbPath: ':memory:' })
    await server.db.ready()
  })

  afterEach(() => {
    fs.rmSync(baseRoot, { recursive: true, force: true })
    fs.rmSync(targetRoot, { recursive: true, force: true })
  })

  it('rejects missing projectRoot with 400', async () => {
    const res = await request(server.app).post('/api/project').send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_INPUT')
  })

  it('rejects non-string projectRoot with 400', async () => {
    const res = await request(server.app).post('/api/project').send({ projectRoot: 123 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_INPUT')
  })

  it('rejects a non-existent directory with 400', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: path.join(baseRoot, 'nope') })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_PROJECT_ROOT')
  })

  it('switches to an existing directory and triggers analysis', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: targetRoot })
    expect(res.status).toBe(200)
    expect(res.body.data.projectRoot).toBe(path.resolve(targetRoot))
    expect(runAnalysisMock).toHaveBeenCalled()
  })
})
