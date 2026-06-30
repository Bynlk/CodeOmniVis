import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { TsRpcParser } from '../../src/parsers/tsrpc'
import { ApiCallsParser } from '../../src/parsers/apiCalls'
import { isEdgeOfType, isNodeOfType } from '@codeomnivis/shared'
import type { NodeType, OmniEdge, OmniNode, ParseContext, ProjectMeta } from '@codeomnivis/shared'

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/tsrpc')

function makeProjectMeta(overrides?: Partial<ProjectMeta>): ProjectMeta {
  return {
    root: FIXTURES_DIR,
    frontendFramework: 'unknown',
    backendFramework: 'tsrpc',
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
    ...overrides,
  }
}

function makeContext(overrides?: Partial<ProjectMeta>): ParseContext {
  return {
    projectRoot: FIXTURES_DIR,
    projectMeta: makeProjectMeta(overrides),
    tsConfig: null,
    pathAliases: {},
  }
}

function expectNodeOfType<T extends NodeType>(
  node: OmniNode | undefined,
  type: T
): asserts node is Extract<OmniNode, { type: T }> {
  expect(node).toBeDefined()
  if (!node || !isNodeOfType(node, type)) {
    throw new Error(`Expected node type ${type}`)
  }
}

function isTsrpcCallApiEdge(edge: OmniEdge): boolean {
  return isEdgeOfType(edge, 'calls_api') && edge.metadata.callType === 'tsrpc_call_api'
}

describe('TSRPC Parser', () => {
  let parser: TsRpcParser

  beforeEach(() => {
    parser = new TsRpcParser()
  })

  it('从 Api*.ts 生成 tsrpc_api 节点，含正确的 name 和 filePath', async () => {
    const filePath = 'api/todo/ApiGetTodos.ts'
    const result = await parser.parse(filePath, makeContext())

    expect(result.errors).toHaveLength(0)
    const apiNodes = result.nodes.filter(n => n.type === 'tsrpc_api')
    expect(apiNodes.length).toBeGreaterThanOrEqual(1)

    const apiNode = apiNodes.find(n => n.name === 'ApiGetTodos')
      expectNodeOfType(apiNode, 'tsrpc_api')
      expect(apiNode.filePath).toContain('ApiGetTodos.ts')
      expect(apiNode.metadata.reqTypeName).toBe('ReqGetTodos')
      expect(apiNode.metadata.resTypeName).toBe('ResGetTodos')
  })

  it('从 Ptl*.ts 生成 Req/Res 协议节点对', async () => {
    const filePath = 'shared/protocols/todo/PtlGetTodos.ts'
    const result = await parser.parse(filePath, makeContext())

    expect(result.errors).toHaveLength(0)
    const names = result.nodes.map(n => n.name)
    expect(names).toContain('ReqGetTodos')
    expect(names).toContain('ResGetTodos')

    const reqNode = result.nodes.find(n => n.name === 'ReqGetTodos')
      expectNodeOfType(reqNode, 'tsrpc_api')
      expect(reqNode.metadata.reqTypeName).toBe('ReqGetTodos')

    const resNode = result.nodes.find(n => n.name === 'ResGetTodos')
      expectNodeOfType(resNode, 'tsrpc_api')
      expect(resNode.metadata.resTypeName).toBe('ResGetTodos')
  })

  it('从 Msg*.ts 生成 tsrpc_msg 节点，transport=ws', async () => {
    const filePath = 'shared/protocols/MsgTodoUpdate.ts'
    const result = await parser.parse(filePath, makeContext())

    expect(result.errors).toHaveLength(0)
    const msgNodes = result.nodes.filter(n => n.type === 'tsrpc_msg')
    expect(msgNodes).toHaveLength(1)

    const msgNode = msgNodes[0]
      expectNodeOfType(msgNode, 'tsrpc_msg')
    expect(msgNode.name).toBe('MsgTodoUpdate')
      expect(msgNode.metadata.transport).toBe('ws')
      expect(msgNode.metadata.msgName).toBe('TodoUpdate')
  })

  it('识别 client.callApi() 生成 calls_api 边', async () => {
    const apiCallsParser = new ApiCallsParser()
    const filePath = 'frontend/calls.ts'
    const result = await apiCallsParser.parse(filePath, makeContext())

    expect(result.errors).toHaveLength(0)
      const callApiEdges = result.edges.filter(isTsrpcCallApiEdge)
    expect(callApiEdges.length).toBeGreaterThanOrEqual(1)
    expect(callApiEdges[0].type).toBe('calls_api')
  })

  it('识别 client.listenMsg() 生成 listens_msg 边', async () => {
    const apiCallsParser = new ApiCallsParser()
    const filePath = 'frontend/calls.ts'
    const result = await apiCallsParser.parse(filePath, makeContext())

    expect(result.errors).toHaveLength(0)
    const listenEdges = result.edges.filter(e => e.type === 'listens_msg')
    expect(listenEdges.length).toBeGreaterThanOrEqual(1)
    expect(listenEdges[0].target).toContain('TodoUpdate')
  })

  it('识别 client.sendMsg() 生成 sends_msg 边', async () => {
    const apiCallsParser = new ApiCallsParser()
    const filePath = 'frontend/calls.ts'
    const result = await apiCallsParser.parse(filePath, makeContext())

    expect(result.errors).toHaveLength(0)
    const sendEdges = result.edges.filter(e => e.type === 'sends_msg')
    expect(sendEdges.length).toBeGreaterThanOrEqual(1)
    expect(sendEdges[0].target).toContain('Chat')
  })

  it('支持子路径：callApi("todo/GetTodos") 正确匹配 ApiGetTodos 节点', async () => {
    const apiCallsParser = new ApiCallsParser()
    const filePath = 'frontend/calls.ts'
    const result = await apiCallsParser.parse(filePath, makeContext())

      const callApiEdges = result.edges.filter(isTsrpcCallApiEdge)
    expect(callApiEdges.length).toBeGreaterThanOrEqual(1)
    // target 应包含 todo/GetTodos 路径
    expect(callApiEdges[0].target).toContain('todo/GetTodos')
  })

  it('canHandle 对非 TSRPC 文件返回 false', () => {
    const meta = makeProjectMeta({ backendFramework: 'unknown' })
    expect(parser.canHandle('src/components/App.tsx', meta)).toBe(false)
    expect(parser.canHandle('src/utils/helper.ts', meta)).toBe(false)
  })

  it('canHandle 对 TSRPC 文件返回 true', () => {
    const meta = makeProjectMeta()
    expect(parser.canHandle('api/todo/ApiGetTodos.ts', meta)).toBe(true)
    expect(parser.canHandle('shared/protocols/todo/PtlGetTodos.ts', meta)).toBe(true)
    expect(parser.canHandle('shared/protocols/MsgTodoUpdate.ts', meta)).toBe(true)
  })

  it('canHandle 对 serviceProto.ts 返回 false', () => {
    const meta = makeProjectMeta()
    expect(parser.canHandle('shared/protocols/serviceProto.ts', meta)).toBe(false)
  })

  it('parse 失败时降级返回空结果，不抛异常', async () => {
    const result = await parser.parse('nonexistent/file.ts', makeContext())
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.errors[0].severity).toBe('warning')
  })

  it('parseServiceProto 正确解析 services 数组', () => {
    const content = `
      export const serviceProto = {
        "services": [
          { "id": 0, "name": "todo/GetTodos", "type": "api" },
          { "id": 1, "name": "todo/CreateTodo", "type": "api" },
          { "id": 2, "name": "TodoUpdate", "type": "msg" }
        ]
      }
    `
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsrpc-proto-'))
    const protoPath = path.join(dir, 'serviceProto.ts')
    fs.writeFileSync(protoPath, content, 'utf-8')
    try {
      const parsed = TsRpcParser.parseServiceProto(protoPath)
      // 两个 api 服务（按短名）+ 一个 msg 服务，路径保留完整名用于匹配。
      expect(parsed.apis.map(a => a.name)).toEqual(['GetTodos', 'CreateTodo'])
      expect(parsed.apis.map(a => a.path)).toEqual(['todo/GetTodos', 'todo/CreateTodo'])
      expect(parsed.msgs.map(m => m.name)).toEqual(['TodoUpdate'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    // 缺失文件安全降级为空结果。
    const missing = TsRpcParser.parseServiceProto(path.join(dir, 'gone.ts'))
    expect(missing.apis).toHaveLength(0)
    expect(missing.msgs).toHaveLength(0)
  })
})
