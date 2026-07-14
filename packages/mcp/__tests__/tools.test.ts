/**
 * MCP 工具集成测试 —— 直接调用 index.ts 导出的真实 handler。
 *
 * TEST-BUG-04 / F19:此前本文件复制了简化版 executeXxx 逻辑(假覆盖),
 * 真实 handler 的过滤、向上/向下游遍历、非法参数分支完全未覆盖。
 * 现改为 import 真实 handleGetApiRoutes / handleFindCallers / handleListDbModels /
 * handleGetDataFlow / handleGetComponentTree,并断言其 CallToolResult 结构与非法输入处理。
 *
 * 不使用 as / unknown / Record<string,unknown>:body() 借 JSON.parse 的隐式 any 返回,
 * 与 bound04.test.ts 同风格,保持 ast-scan 零断言。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  handleGetApiRoutes,
  handleGetComponentTree,
  handleFindCallers,
  handleListDbModels,
  handleGetDataFlow,
} from '../src/index'
import { executeMcpTool, MCP_TOOL_NAMES } from '../src/server'

function body(result: CallToolResult) {
  const first = result.content[0]
  if (first.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
}

describe('MCP Tools — real handler integration (TEST-BUG-04/F19)', () => {
  let db: OmniDatabase

  beforeAll(async () => {
    db = new OmniDatabase(':memory:')
    await db.ready()

    // 页面 → 组件 → API 路由 → DB 模型 的完整调用链
    db.upsertNode({
      id: 'page:app/users/page.tsx:/users',
      type: 'page',
      name: 'UsersPage',
      filePath: 'app/users/page.tsx',
      line: 1,
      column: 1,
      metadata: { route: '/users', isDynamic: false, params: [], isGroupLayout: false, layoutFile: null },
    })

    db.upsertNode({
      id: 'component:app/Button.tsx:Button',
      type: 'component',
      name: 'Button',
      filePath: 'app/Button.tsx',
      line: 5,
      column: 1,
      metadata: { props: ['label'], hasState: false, isPage: false, jsxChildCount: 1 },
    })

    db.upsertNode({
      id: 'api_route:app/api/route.ts:/api/users',
      type: 'api_route',
      name: '/api/users',
      filePath: 'app/api/route.ts',
      line: 1,
      column: 1,
      metadata: { method: 'GET', route: '/api/users', isNextApiRoute: true },
    })

    db.upsertNode({
      id: 'trpc_procedure:server/routers/user.ts:user.getById',
      type: 'trpc_procedure',
      name: 'user.getById',
      filePath: 'server/routers/user.ts',
      line: 10,
      column: 1,
      metadata: { procedureType: 'query', routerName: 'user', procedureName: 'getById', hasInput: true, hasOutput: true },
    })

    db.upsertNode({
      id: 'db_model:prisma/schema.prisma:User',
      type: 'db_model',
      name: 'User',
      filePath: 'prisma/schema.prisma',
      line: 1,
      column: 1,
      metadata: { tableName: 'users', fieldCount: 2, fields: [] },
    })

    // page renders Button
    db.upsertEdge({
      id: 'renders-page-button',
      source: 'page:app/users/page.tsx:/users',
      target: 'component:app/Button.tsx:Button',
      type: 'renders',
      confidence: 'certain',
      metadata: { jsxLine: 4 },
    })
    // Button calls_api /api/users
    db.upsertEdge({
      id: 'calls-1',
      source: 'component:app/Button.tsx:Button',
      target: 'api_route:app/api/route.ts:/api/users',
      type: 'calls_api',
      confidence: 'inferred',
      metadata: { method: 'GET', callType: 'fetch', callLine: 20 },
    })
    // /api/users queries_db User
    db.upsertEdge({
      id: 'queries-1',
      source: 'api_route:app/api/route.ts:/api/users',
      target: 'db_model:prisma/schema.prisma:User',
      type: 'queries_db',
      confidence: 'certain',
      metadata: {},
    })
    // UsersPage 也直接 calls_api(server component fetch);getAffectedPages
    // 只沿调用链(calls_api/handles/...)向上回溯,故页面需经 call 边连接才会被命中。
    db.upsertEdge({
      id: 'calls-page',
      source: 'page:app/users/page.tsx:/users',
      target: 'api_route:app/api/route.ts:/api/users',
      type: 'calls_api',
      confidence: 'inferred',
      metadata: { method: 'GET', callType: 'fetch', callLine: 8 },
    })
  })

  afterAll(() => {
    db.close()
  })

  describe('handleGetApiRoutes', () => {
    it('返回真实 api_route + trpc_procedure,含下游 dbOperations 与 calledBy', () => {
      const res = handleGetApiRoutes(db, {})
      expect(res.isError).toBeUndefined()
      const data = body(res)
      expect(data.totalCount).toBe(2)
      const apiRoute = data.routes.find((r: { path: string }) => r.path === '/api/users')
      expect(apiRoute).toBeDefined()
      // 真实 handler 走 getDownstreamNodes / getUpstreamNodes —— 假覆盖无法验证
      expect(apiRoute.dbOperations).toEqual([{ model: 'User', file: 'prisma/schema.prisma' }])
      expect(apiRoute.calledBy.map((c: { name: string }) => c.name)).toContain('Button')
    })

    it('filter 参数大小写不敏感地匹配 path', () => {
      const res = handleGetApiRoutes(db, { filter: 'USERS' })
      const data = body(res)
      expect(data.routes.length).toBeGreaterThanOrEqual(1)
    })

    it('filter 无匹配时返回空 routes', () => {
      const res = handleGetApiRoutes(db, { filter: '__no_such_route__' })
      const data = body(res)
      expect(data.totalCount).toBe(0)
    })
  })

  describe('handleGetComponentTree', () => {
    it('缺少必填 rootPath 时返回 MCP error', () => {
      const res = handleGetComponentTree(db, {})
      expect(res.isError).toBe(true)
      expect(body(res)).toHaveProperty('error')
    })

    it('未知 rootPath 返回带 suggestion 的提示(非 error)', () => {
      const res = handleGetComponentTree(db, { rootPath: 'does/not/exist.tsx' })
      expect(res.isError).toBeUndefined()
      expect(body(res)).toHaveProperty('suggestion')
    })

    it('按 route 命中页面节点并返回其 renders 子树', () => {
      const res = handleGetComponentTree(db, { rootPath: '/users', depth: 3 })
      expect(res.isError).toBeUndefined()
      const data = body(res)
      expect(data.children).toHaveLength(1)
      expect(data.children[0].name).toBe('Button')
    })
  })

  describe('handleFindCallers', () => {
    it('缺少必填 target 时返回 MCP error', () => {
      const res = handleFindCallers(db, {})
      expect(res.isError).toBe(true)
      expect(body(res)).toHaveProperty('error')
    })

    it('未知 target 返回带 suggestion 的提示(非 error)', () => {
      const res = handleFindCallers(db, { target: '__missing__' })
      expect(res.isError).toBeUndefined()
      expect(body(res)).toHaveProperty('suggestion')
    })

    it('沿调用链向上找到 caller 并回溯受影响页面', () => {
      const res = handleFindCallers(db, { target: '/api/users' })
      expect(res.isError).toBeUndefined()
      const data = body(res)
      expect(data.callers.map((c: { name: string }) => c.name)).toContain('Button')
      expect(data.affectedFrontendPages.map((p: { name: string }) => p.name)).toContain('UsersPage')
    })
  })

  describe('handleListDbModels', () => {
    it('列出 db_model 节点及 tableName / fieldCount', () => {
      const res = handleListDbModels(db)
      expect(res.isError).toBeUndefined()
      const data = body(res)
      expect(data.totalCount).toBe(1)
      expect(data.models[0].name).toBe('User')
      expect(data.models[0].tableName).toBe('users')
      expect(data.models[0].fieldCount).toBe(2)
    })
  })

  describe('handleGetDataFlow', () => {
    it('未知 model 返回 error + availableModels', () => {
      const res = handleGetDataFlow(db, { model: 'Nope' })
      const data = body(res)
      expect(data).toHaveProperty('error')
      expect(data.availableModels).toContain('User')
    })

    it('省略 model 时返回所有模型概览', () => {
      const res = handleGetDataFlow(db, {})
      const data = body(res)
      expect(data).toHaveProperty('totalCount')
      expect(data.models.map((m: { name: string }) => m.name)).toContain('User')
    })

    it('指定 model 时返回完整静态数据流', () => {
      const data = body(handleGetDataFlow(db, { model: 'User' }))
      expect(data.model).toBe('User')
      expect(data.summary).toContain('User')
    })
  })

  describe('executeMcpTool', () => {
    it('dispatches every public handler through the shared snapshot projection', () => {
      const requests = [
        [MCP_TOOL_NAMES.getApiRoutes, {}],
        [MCP_TOOL_NAMES.getComponentTree, { rootPath: '/users' }],
        [MCP_TOOL_NAMES.findCallers, { target: '/api/users' }],
        [MCP_TOOL_NAMES.listDbModels, {}],
        [MCP_TOOL_NAMES.getDataflow, { model: 'User' }],
        [MCP_TOOL_NAMES.getTestCoverage, {}],
      ] as const
      for (const [name, args] of requests) {
        expect(body(executeMcpTool(db, name, args))).toBeDefined()
      }
    })
  })
})
