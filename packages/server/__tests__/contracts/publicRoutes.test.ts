import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOmniServer, type ServerInstance } from '../../src/index'
import { IncrementalAnalyzer } from '../../src/incremental'

interface RouteCase {
  method: 'delete' | 'get' | 'post'
  path: string
  headers?: Record<string, string>
}

const PUBLIC_ROUTES: RouteCase[] = [
  { method: 'get', path: '/api/health' },
  { method: 'get', path: '/api/status' },
  { method: 'get', path: '/api/project' },
  { method: 'get', path: '/api/graph' },
  { method: 'get', path: '/api/graph/nodes' },
  { method: 'get', path: '/api/graph/edges' },
  { method: 'get', path: '/api/graph/stats' },
  { method: 'get', path: '/api/graph/errors' },
  { method: 'get', path: '/api/graph/issues' },
  { method: 'get', path: '/api/graph/trace' },
  { method: 'get', path: '/api/graph/dataflow' },
  { method: 'delete', path: '/api/graph', headers: { 'X-Confirm': 'true' } },
  { method: 'post', path: '/api/analyze' },
  { method: 'post', path: '/api/project' },
  { method: 'post', path: '/api/ai/chat' },
  { method: 'post', path: '/api/ai/explain' },
]

describe('public REST contract', () => {
  let projectRoot: string
  let instance: ServerInstance

  beforeEach(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'codeomnivis-route-contract-'))
    writeFileSync(join(projectRoot, 'index.ts'), 'export const value = true\n')
    vi.spyOn(IncrementalAnalyzer.prototype, 'refresh').mockResolvedValue(undefined)
    instance = createOmniServer({
      host: '127.0.0.1',
      port: 0,
      projectRoot,
      uiDistPath: projectRoot,
    })
    await instance.start()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await instance.stop()
    rmSync(projectRoot, { recursive: true, force: true })
  })

  it.each(PUBLIC_ROUTES)('keeps $method $path registered', async route => {
    let pending = request(instance.app)[route.method](route.path)
    for (const [name, value] of Object.entries(route.headers ?? {})) {
      pending = pending.set(name, value)
    }
    const response = await pending.send({})

    expect(response.status).not.toBe(404)
  })
})
