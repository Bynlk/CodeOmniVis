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
import type { OmniNode, ProjectMeta } from '@codeomnivis/shared'
import { codeomnivisEvents } from '../../src/events'

vi.mock('@codeomnivis/analyzer', async () => {
  const actual = await vi.importActual<typeof import('@codeomnivis/analyzer')>('@codeomnivis/analyzer')
  return { ...actual, runAnalysis: vi.fn() }
})

const analyzerModule = await import('@codeomnivis/analyzer')
const runAnalysisMock = vi.mocked(analyzerModule.runAnalysis)
const { createOmniServer } = await import('../../src/index')

function projectMeta(root: string, backendFramework: ProjectMeta['backendFramework']): ProjectMeta {
  return {
    root,
    frontendFramework: 'unknown',
    backendFramework,
    databaseType: 'unknown',
    monorepoType: 'none',
    frontendDirs: [],
    backendDirs: [],
    trpcRouterPaths: [],
    tsrpcServicePaths: [],
    tsrpcApiDirs: [],
    tsrpcProtocolDirs: [],
    prismaSchemaPath: null,
    typeormEntityDirs: [],
    tsConfigPath: null,
    buildFile: null,
    packages: [],
  }
}

const retainedNode: OmniNode = {
  id: 'page:app/page.tsx:retained',
  type: 'page',
  name: 'retained',
  filePath: 'app/page.tsx',
  line: 1,
  column: 1,
  metadata: { route: '/', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
}

describe('/api/project', () => {
  let server: ReturnType<typeof createOmniServer>
  let baseRoot: string
  let targetRoot: string
  let siblingRoot: string

  beforeEach(async () => {
    codeomnivisEvents.removeAllListeners()
    runAnalysisMock.mockReset()
    runAnalysisMock.mockResolvedValue({
      filesScanned: 0, nodesCreated: 0, edgesCreated: 0, crossLayerEdges: 0, errors: 0,
    })
    baseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-base-'))
    siblingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-sibling-'))
    targetRoot = path.join(baseRoot, 'sub-target')
    fs.mkdirSync(targetRoot, { recursive: true })
    server = createOmniServer({ projectRoot: baseRoot, dbPath: ':memory:' })
    await server.db.ready()
  })

  afterEach(async () => {
    await server.stop()
    fs.rmSync(baseRoot, { recursive: true, force: true })
    fs.rmSync(siblingRoot, { recursive: true, force: true })
  })

  it('returns the active absolute project root', async () => {
    const res = await request(server.app).get('/api/project')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { projectRoot: path.resolve(baseRoot) }, meta: {} })
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

    const current = await request(server.app).get('/api/project')
    expect(current.body.data.projectRoot).toBe(path.resolve(targetRoot))
  })

  it('allows a loopback workspace to switch to an existing sibling absolute directory', async () => {
    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: siblingRoot })

    expect(res.status).toBe(200)
    expect(res.body.data.projectRoot).toBe(path.resolve(siblingRoot))
    expect(runAnalysisMock).toHaveBeenCalled()
  })

  it('detects metadata for the target root and analyzes with that metadata', async () => {
    await server.stop()
    const initialMeta = projectMeta(baseRoot, 'trpc')
    const targetMeta = projectMeta(siblingRoot, 'express')
    const detectProjectMeta = vi.fn(async () => targetMeta)
    server = createOmniServer({
      projectRoot: baseRoot,
      projectMeta: initialMeta,
      detectProjectMeta,
      dbPath: ':memory:',
    })
    await server.db.ready()

    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: siblingRoot })

    expect(res.status).toBe(200)
    expect(detectProjectMeta).toHaveBeenCalledWith(path.resolve(siblingRoot))
    expect(runAnalysisMock).toHaveBeenLastCalledWith(expect.objectContaining({
      projectRoot: path.resolve(siblingRoot),
      projectMeta: targetMeta,
    }))
  })

  it('keeps the active project and graph when target metadata detection fails', async () => {
    await server.stop()
    const detectProjectMeta = vi.fn(async () => {
      throw new Error('metadata failed')
    })
    server = createOmniServer({
      projectRoot: baseRoot,
      projectMeta: projectMeta(baseRoot, 'trpc'),
      detectProjectMeta,
      dbPath: ':memory:',
    })
    await server.db.ready()
    server.db.upsertNode(retainedNode)

    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: siblingRoot })

    expect(res.status).toBe(500)
    expect(res.body.error).toEqual(expect.objectContaining({ code: 'PROJECT_DETECTION_FAILED' }))
    expect(res.body.error).not.toHaveProperty('stack')
    expect(detectProjectMeta).toHaveBeenCalledWith(path.resolve(siblingRoot))
    expect(runAnalysisMock).not.toHaveBeenCalled()

    const current = await request(server.app).get('/api/project')
    const graph = await request(server.app).get('/api/graph')
    expect(current.body.data.projectRoot).toBe(path.resolve(baseRoot))
    expect(graph.body.data.nodes).toEqual([retainedNode])
  })

  it('restores the active project and returns a safe error when target analysis fails', async () => {
    await server.stop()
    server = createOmniServer({
      projectRoot: baseRoot,
      projectMeta: projectMeta(baseRoot, 'trpc'),
      detectProjectMeta: async root => projectMeta(root, 'express'),
      dbPath: ':memory:',
    })
    await server.db.ready()
    server.db.upsertNode(retainedNode)
    runAnalysisMock.mockImplementationOnce(async ({ db }) => {
      db?.clearGraph()
      throw new Error('sensitive target analysis detail')
    })

    const res = await request(server.app)
      .post('/api/project')
      .send({ projectRoot: siblingRoot })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      error: {
        code: 'PROJECT_SWITCH_FAILED',
        message: 'Failed to switch project',
      },
    })

    const current = await request(server.app).get('/api/project')
    const graph = await request(server.app).get('/api/graph')
    expect(current.body.data.projectRoot).toBe(path.resolve(baseRoot))
    expect(graph.body.data.nodes).toEqual([retainedNode])
  })
})
