import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getGraph,
  getGraphStats,
  getGraphErrors,
  getGraphIssues,
  getGraphNodes,
  getGraphDataflow,
} from '../../src/services'

function mockFetchOnce(status: number, body: unknown): void {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: () => Promise.resolve(body),
  }
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(res)))
}

function captureFetch(status: number, body: unknown) {
  const spy = vi.fn(() => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: () => Promise.resolve(body),
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('graph service — URL/method 契约', () => {
  it('getGraph 请求 /api/graph 且解包 { data, meta }', async () => {
    const spy = captureFetch(200, { data: { nodes: [], edges: [] }, meta: { nodeCount: 0, edgeCount: 0, nodesByType: {}, edgesByType: {} } })
    const res = await getGraph()
    expect(spy).toHaveBeenCalledWith('/api/graph', undefined)
    expect(res.data).toEqual({ nodes: [], edges: [] })
  })

  it('getGraphStats 请求 /api/graph/stats 且从 data 解包', async () => {
    const spy = captureFetch(200, { data: { nodeCount: 3, edgeCount: 2, errorCount: 0, nodeTypeCounts: {}, edgeTypeCounts: {} } })
    const res = await getGraphStats()
    expect(spy).toHaveBeenCalledWith('/api/graph/stats', undefined)
    expect(res.nodeCount).toBe(3)
  })

  it('getGraphErrors 请求 /api/graph/errors 且过滤为合法 ParseError[]', async () => {
    const spy = captureFetch(200, { data: [
      { file: 'a.ts', message: 'boom', severity: 'error' },
      { file: 'b.ts', message: 'bad', severity: 'nope' }, // 非法 severity 应被过滤
    ] })
    const res = await getGraphErrors()
    expect(spy).toHaveBeenCalledWith('/api/graph/errors', undefined)
    expect(res).toHaveLength(1)
    expect(res[0].severity).toBe('error')
  })

  it('getGraphIssues validates sourced issues and preserves detector failures', async () => {
    const spy = captureFetch(200, {
      data: [
        {
          id: 'auth-route',
          source: 'security',
          severity: 'critical',
          type: 'unguarded_route',
          description: 'Missing authentication guard',
          messageKey: 'unguarded_route',
          messageParams: { route: 'GET /api/demo' },
          locations: [{ file: 'app/api/route.ts', line: 4 }],
          relatedNodeIds: ['handler:route'],
          relatedEdgeIds: [],
        },
        { id: 'invalid', source: 'guess' },
      ],
      meta: {
        count: 1,
        total: 1,
        critical: 1,
        warning: 0,
        info: 0,
        detectors: [
          { id: 'consistency', status: 'complete' },
          { id: 'auth', status: 'failed', message: 'source unavailable' },
          { id: 'n_plus_one', status: 'complete' },
          { id: 'rsc', status: 'complete' },
        ],
      },
    })

    const result = await getGraphIssues()

    expect(spy).toHaveBeenCalledWith('/api/graph/issues', undefined)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      source: 'security',
      type: 'unguarded_route',
      messageKey: 'unguarded_route',
      messageParams: { route: 'GET /api/demo' },
    })
    expect(result.detectors[1]).toEqual({ id: 'auth', status: 'failed', message: 'source unavailable' })
  })

  it('getGraphIssues rejects a malformed response envelope', async () => {
    captureFetch(200, { data: [], meta: { count: 'zero' } })

    await expect(getGraphIssues()).rejects.toThrow('Invalid graph issues response')
  })

  it('filters issues with malformed structured message parameters', async () => {
    captureFetch(200, {
      data: [{
        id: 'auth-route',
        source: 'security',
        severity: 'critical',
        type: 'unguarded_route',
        description: 'Missing authentication guard',
        messageKey: 'unguarded_route',
        messageParams: { route: { unsafe: true } },
        locations: [{ file: 'app/api/route.ts', line: 4 }],
        relatedNodeIds: [],
        relatedEdgeIds: [],
      }],
      meta: {
        count: 0,
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        detectors: [
          { id: 'consistency', status: 'complete' },
          { id: 'auth', status: 'complete' },
          { id: 'n_plus_one', status: 'complete' },
          { id: 'rsc', status: 'complete' },
        ],
      },
    })

    const result = await getGraphIssues()
    expect(result.issues).toEqual([])
  })

  it('getGraphIssues rejects summary counts that contradict the findings', async () => {
    captureFetch(200, {
      data: [{
        id: 'auth-route',
        source: 'security',
        severity: 'critical',
        type: 'unguarded_route',
        description: 'Missing authentication guard',
        locations: [{ file: 'app/api/route.ts', line: 4 }],
        relatedNodeIds: [],
        relatedEdgeIds: [],
      }],
      meta: {
        count: 1,
        total: 1,
        critical: 0,
        warning: 1,
        info: 0,
        detectors: [
          { id: 'consistency', status: 'complete' },
          { id: 'auth', status: 'complete' },
          { id: 'n_plus_one', status: 'complete' },
          { id: 'rsc', status: 'complete' },
        ],
      },
    })

    await expect(getGraphIssues()).rejects.toThrow('Invalid graph issues response')
  })

  it('getGraphNodes 携带 type 查询参数请求 /api/graph/nodes', async () => {
    const spy = captureFetch(200, { data: [{ id: 'm1', name: 'User' }] })
    const res = await getGraphNodes('db_model')
    expect(spy).toHaveBeenCalledWith('/api/graph/nodes?type=db_model', undefined)
    expect(res).toEqual([{ id: 'm1', name: 'User' }])
  })

  it('getGraphDataflow 带 model 时拼接查询参数', async () => {
    const spy = captureFetch(200, { data: [{ modelId: 'm1', modelName: 'User', paths: [], totalRoutes: 0, totalComponents: 0 }] })
    await getGraphDataflow('User')
    expect(spy).toHaveBeenCalledWith('/api/graph/dataflow?model=User', undefined)
  })

  it('getGraphDataflow 不带 model 时请求裸端点', async () => {
    const spy = captureFetch(200, { data: [] })
    await getGraphDataflow()
    expect(spy).toHaveBeenCalledWith('/api/graph/dataflow', undefined)
  })

  it('非 2xx 抛出 ApiError（保留 status）', async () => {
    mockFetchOnce(500, {})
    await expect(getGraph()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})
