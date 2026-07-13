import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import request from 'supertest'

vi.mock('@codeomnivis/analyzer', async () => {
  const actual = await vi.importActual<typeof import('@codeomnivis/analyzer')>('@codeomnivis/analyzer')
  return { ...actual, runAnalysis: vi.fn() }
})

const analyzerModule = await import('@codeomnivis/analyzer')
const runAnalysisMock = vi.mocked(analyzerModule.runAnalysis)
const { createOmniServer } = await import('../../src/index')

describe('POST /api/analyze', () => {
  let projectRoot: string
  let server: ReturnType<typeof createOmniServer>
  let restoreConsole = () => {}

  beforeEach(async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    restoreConsole = () => {
      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    }
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analyze-route-'))
    server = createOmniServer({ projectRoot, dbPath: ':memory:' })
    await server.db.ready()
  })

  afterEach(() => {
    restoreConsole()
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('returns a structured API error when analysis fails', async () => {
    runAnalysisMock.mockRejectedValueOnce(new Error('analysis exploded'))

    const response = await request(server.app).post('/api/analyze').send({})

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      error: { code: 'ANALYSIS_FAILED', message: 'analysis exploded' },
    })
  })
})
