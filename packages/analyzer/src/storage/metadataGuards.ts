/**
 * 存储边界元数据解析。
 *
 * DB 中的 metadata 以 JSON 字符串存储，读取后是 `JsonObject`（unknown 边界）。
 * 本模块按 node/edge 的 `type` 将其收敛为具体的 typed metadata，
 * 缺字段时采用与解析器一致的「降级而非崩溃」保守默认，
 * 不使用 cast，也不返回泛型 `Record<string, unknown>` fallback。
 */

import type {
  JsonObject,
  JsonValue,
  NodeType,
  NodeTypeMetadataMap,
  EdgeType,
  EdgeTypeMetadataMap,
  OmniNode,
  OmniEdge,
  EdgeConfidence,
} from '@codeomnivis/shared'
import { isJsonObject, createTypedNode, createTypedEdge, isNodeType } from '@codeomnivis/shared'

/** 节点公共字段（除 type/metadata 外）。 */
export interface NodeBase {
  id: string
  name: string
  filePath: string
  line: number
  column: number
}

/** 边公共字段（除 type/metadata 外）。 */
export interface EdgeBase {
  id: string
  source: string
  target: string
  confidence: EdgeConfidence
}

// ============================================================
// 字段读取器（带保守默认）
// ============================================================

function str(o: JsonObject, key: string, fallback = ''): string {
  const v = o[key]
  return typeof v === 'string' ? v : fallback
}

function optStr(o: JsonObject, key: string): string | undefined {
  const v = o[key]
  return typeof v === 'string' ? v : undefined
}

function strOrNull(o: JsonObject, key: string): string | null {
  const v = o[key]
  return typeof v === 'string' ? v : null
}

function num(o: JsonObject, key: string, fallback = 0): number {
  const v = o[key]
  return typeof v === 'number' ? v : fallback
}

function optNum(o: JsonObject, key: string): number | undefined {
  const v = o[key]
  return typeof v === 'number' ? v : undefined
}

function bool(o: JsonObject, key: string, fallback = false): boolean {
  const v = o[key]
  return typeof v === 'boolean' ? v : fallback
}

function optBool(o: JsonObject, key: string): boolean | undefined {
  const v = o[key]
  return typeof v === 'boolean' ? v : undefined
}

function strArr(o: JsonObject, key: string): string[] {
  const v = o[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** 在给定字面量集合内匹配，否则返回 fallback；fallback 同时作为允许值之一。 */
function literal<T extends string>(o: JsonObject, key: string, fallback: T, ...rest: T[]): T {
  const v = o[key]
  if (typeof v !== 'string') return fallback
  if (v === fallback) return fallback
  for (const a of rest) {
    if (a === v) return a
  }
  return fallback
}

// ============================================================
// 节点元数据解析
// ============================================================

/**
 * 按 type 还原存储节点为判别联合 OmniNode。
 * switch 各分支中 `type` 收窄为字面量，createTypedNode 由此推导对应 metadata 形状，
 * 无需 cast。
 */
export function parseStoredNode(base: NodeBase, type: NodeType, o: JsonObject): OmniNode {
  switch (type) {
    case 'page':
      return createTypedNode({ ...base, type, metadata: nodeParsers.page(o) })
    case 'component':
      return createTypedNode({ ...base, type, metadata: nodeParsers.component(o) })
    case 'api_route':
      return createTypedNode({ ...base, type, metadata: nodeParsers.api_route(o) })
    case 'trpc_procedure':
      return createTypedNode({ ...base, type, metadata: nodeParsers.trpc_procedure(o) })
    case 'tsrpc_service':
      return createTypedNode({ ...base, type, metadata: nodeParsers.tsrpc_service(o) })
    case 'tsrpc_api':
      return createTypedNode({ ...base, type, metadata: nodeParsers.tsrpc_api(o) })
    case 'tsrpc_msg':
      return createTypedNode({ ...base, type, metadata: nodeParsers.tsrpc_msg(o) })
    case 'express_route':
      return createTypedNode({ ...base, type, metadata: nodeParsers.express_route(o) })
    case 'handler':
      return createTypedNode({ ...base, type, metadata: nodeParsers.handler(o) })
    case 'service':
      return createTypedNode({ ...base, type, metadata: nodeParsers.service(o) })
    case 'db_model':
      return createTypedNode({ ...base, type, metadata: nodeParsers.db_model(o) })
    case 'module':
      return createTypedNode({ ...base, type, metadata: nodeParsers.module(o) })
    case 'kotlin_class':
      return createTypedNode({ ...base, type, metadata: nodeParsers.kotlin_class(o) })
    case 'kotlin_interface':
      return createTypedNode({ ...base, type, metadata: nodeParsers.kotlin_interface(o) })
    case 'kotlin_object':
      return createTypedNode({ ...base, type, metadata: nodeParsers.kotlin_object(o) })
    case 'kotlin_function':
      return createTypedNode({ ...base, type, metadata: nodeParsers.kotlin_function(o) })
    case 'kotlin_route':
      return createTypedNode({ ...base, type, metadata: nodeParsers.kotlin_route(o) })
    case 'test_suite':
      return createTypedNode({ ...base, type, metadata: nodeParsers.test_suite(o) })
    case 'test_case':
      return createTypedNode({ ...base, type, metadata: nodeParsers.test_case(o) })
    case 'test_fixture':
      return createTypedNode({ ...base, type, metadata: nodeParsers.test_fixture(o) })
  }
}

const nodeParsers: { [T in NodeType]: (o: JsonObject) => NodeTypeMetadataMap[T] } = {
  page: (o) => ({
    route: str(o, 'route'),
    isDynamic: bool(o, 'isDynamic'),
    params: strArr(o, 'params'),
    isGroupLayout: bool(o, 'isGroupLayout'),
    layoutFile: strOrNull(o, 'layoutFile'),
  }),
  component: (o) => ({
    props: strArr(o, 'props'),
    hasState: bool(o, 'hasState'),
    isPage: bool(o, 'isPage'),
    jsxChildCount: num(o, 'jsxChildCount'),
  }),
  api_route: (o) => ({
    method: str(o, 'method'),
    route: str(o, 'route'),
    isNextApiRoute: bool(o, 'isNextApiRoute'),
  }),
  trpc_procedure: (o) => ({
    procedureType: literal(o, 'procedureType', 'query', 'mutation', 'subscription'),
    routerName: str(o, 'routerName'),
    procedureName: str(o, 'procedureName'),
    hasInput: bool(o, 'hasInput'),
    hasOutput: bool(o, 'hasOutput'),
    ...(optBool(o, 'isRouter') !== undefined ? { isRouter: optBool(o, 'isRouter') } : {}),
  }),
  tsrpc_service: (o) => ({
    servicePath: str(o, 'servicePath'),
    transport: literal(o, 'transport', 'http', 'ws'),
    reqTypeName: strOrNull(o, 'reqTypeName'),
    resTypeName: strOrNull(o, 'resTypeName'),
    hasCustomError: bool(o, 'hasCustomError'),
    ...(optBool(o, 'isMessage') !== undefined ? { isMessage: optBool(o, 'isMessage') } : {}),
  }),
  tsrpc_api: (o) => ({
    apiPath: str(o, 'apiPath'),
    transport: literal(o, 'transport', 'http', 'ws'),
    reqTypeName: strOrNull(o, 'reqTypeName'),
    resTypeName: strOrNull(o, 'resTypeName'),
    hasCustomError: bool(o, 'hasCustomError'),
    ...(isJsonObject(o.conf) ? { conf: o.conf } : {}),
    ...(optStr(o, 'protocolFilePath') !== undefined
      ? { protocolFilePath: optStr(o, 'protocolFilePath') }
      : {}),
  }),
  tsrpc_msg: (o) => ({
    msgName: str(o, 'msgName'),
    msgTypeName: str(o, 'msgTypeName'),
    transport: literal(o, 'transport', 'ws', 'http'),
    hasImplementation: bool(o, 'hasImplementation'),
  }),
  express_route: (o) => ({
    method: str(o, 'method'),
    route: str(o, 'route'),
    middleware: strArr(o, 'middleware'),
  }),
  handler: (o) => ({
    functionName: str(o, 'functionName'),
    routeId: strOrNull(o, 'routeId'),
    ...(optBool(o, 'isSynthetic') !== undefined ? { isSynthetic: optBool(o, 'isSynthetic') } : {}),
  }),
  service: (o) => ({
    className: strOrNull(o, 'className'),
    methodName: str(o, 'methodName'),
    ...(optBool(o, 'isSynthetic') !== undefined ? { isSynthetic: optBool(o, 'isSynthetic') } : {}),
    ...(optStr(o, 'importedFrom') !== undefined ? { importedFrom: optStr(o, 'importedFrom') } : {}),
    ...(optBool(o, 'discoveredBySymbolResolver') !== undefined
      ? { discoveredBySymbolResolver: optBool(o, 'discoveredBySymbolResolver') }
      : {}),
  }),
  db_model: (o) => ({
    tableName: str(o, 'tableName'),
    fieldCount: num(o, 'fieldCount'),
    fields: parseDbFields(o.fields),
  }),
  module: (o) => ({
    childCount: num(o, 'childCount'),
    childTypes: strArr(o, 'childTypes').filter(isNodeType),
    ...(optStr(o, 'routePrefix') !== undefined ? { routePrefix: optStr(o, 'routePrefix') } : {}),
    ...(optStr(o, 'dirPath') !== undefined ? { dirPath: optStr(o, 'dirPath') } : {}),
  }),
  kotlin_class: (o) => ({
    className: str(o, 'className'),
    kind: literal(o, 'kind', 'regular', 'data', 'sealed', 'abstract', 'open', 'value', 'inner'),
    packageName: str(o, 'packageName'),
    annotations: strArr(o, 'annotations'),
    ...(optStr(o, 'superClass') !== undefined ? { superClass: optStr(o, 'superClass') } : {}),
    interfaces: strArr(o, 'interfaces'),
  }),
  kotlin_interface: (o) => ({
    interfaceName: str(o, 'interfaceName'),
    packageName: str(o, 'packageName'),
    annotations: strArr(o, 'annotations'),
    superInterfaces: strArr(o, 'superInterfaces'),
  }),
  kotlin_object: (o) => ({
    objectName: str(o, 'objectName'),
    packageName: str(o, 'packageName'),
    isCompanion: bool(o, 'isCompanion'),
    annotations: strArr(o, 'annotations'),
  }),
  kotlin_function: (o) => ({
    functionName: str(o, 'functionName'),
    packageName: str(o, 'packageName'),
    isTopLevel: bool(o, 'isTopLevel'),
    isExtension: bool(o, 'isExtension'),
    ...(optStr(o, 'receiverType') !== undefined ? { receiverType: optStr(o, 'receiverType') } : {}),
    ...(optStr(o, 'returnType') !== undefined ? { returnType: optStr(o, 'returnType') } : {}),
    annotations: strArr(o, 'annotations'),
  }),
  kotlin_route: (o) => ({
    method: literal(o, 'method', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'),
    path: str(o, 'path'),
    framework: literal(o, 'framework', 'spring', 'ktor'),
    annotations: strArr(o, 'annotations'),
  }),
  test_suite: (o) => ({
    framework: literal(
      o,
      'framework',
      'vitest',
      'jest',
      'playwright',
      'cypress',
      'junit4',
      'junit5',
      'kotest',
    ),
    kind: literal(o, 'kind', 'file', 'describe', 'class', 'nested_class', 'spec'),
  }),
  test_case: (o) => ({
    framework: literal(
      o,
      'framework',
      'vitest',
      'jest',
      'playwright',
      'cypress',
      'junit4',
      'junit5',
      'kotest',
    ),
    isParameterized: bool(o, 'isParameterized'),
    ...(optStr(o, 'parameterSource') !== undefined
      ? { parameterSource: optStr(o, 'parameterSource') }
      : {}),
    disabled: bool(o, 'disabled'),
  }),
  test_fixture: (o) => ({
    framework: literal(
      o,
      'framework',
      'vitest',
      'jest',
      'playwright',
      'cypress',
      'junit4',
      'junit5',
      'kotest',
    ),
    lifecycle: literal(
      o,
      'lifecycle',
      'before_each',
      'before_all',
      'after_each',
      'after_all',
      'factory',
    ),
  }),
}

function parseDbFields(v: JsonValue | undefined): NodeTypeMetadataMap['db_model']['fields'] {
  if (!Array.isArray(v)) return []
  const out: NodeTypeMetadataMap['db_model']['fields'] = []
  for (const item of v) {
    if (!isJsonObject(item)) continue
    out.push({
      name: str(item, 'name'),
      type: str(item, 'type'),
      isRequired: bool(item, 'isRequired'),
      isId: bool(item, 'isId'),
      isRelation: bool(item, 'isRelation'),
    })
  }
  return out
}

// ============================================================
// 边元数据解析
// ============================================================

/**
 * 按 type 还原存储边为判别联合 OmniEdge（同 parseStoredNode 思路，无 cast）。
 */
export function parseStoredEdge(base: EdgeBase, type: EdgeType, o: JsonObject): OmniEdge {
  switch (type) {
    case 'renders':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.renders(o) })
    case 'navigates_to':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.navigates_to(o) })
    case 'calls_api':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.calls_api(o) })
    case 'handles':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.handles(o) })
    case 'calls_service':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.calls_service(o) })
    case 'queries_db':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.queries_db(o) })
    case 'db_relation':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.db_relation(o) })
    case 'imports':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.imports(o) })
    case 'contains':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.contains(o) })
    case 'kotlin_inherits':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.kotlin_inherits(o) })
    case 'kotlin_implements':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.kotlin_implements(o) })
    case 'kotlin_uses':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.kotlin_uses(o) })
    case 'data_flows_to':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.data_flows_to(o) })
    case 'sends_msg':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.sends_msg(o) })
    case 'listens_msg':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.listens_msg(o) })
    case 'tests':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.tests(o) })
    case 'covers':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.covers(o) })
    case 'uses_fixture':
      return createTypedEdge({ ...base, type, metadata: edgeParsers.uses_fixture(o) })
  }
}

function parseCallsApi(o: JsonObject): EdgeTypeMetadataMap['calls_api'] {
  return {
    callType: literal(
      o,
      'callType',
      'fetch',
      'axios',
      'trpc_hook',
      'tsrpc_call_api',
      'tsrpc_listen_msg',
    ),
    callLine: num(o, 'callLine'),
    ...(optStr(o, 'method') !== undefined ? { method: optStr(o, 'method') } : {}),
    ...(optStr(o, 'url') !== undefined ? { url: optStr(o, 'url') } : {}),
    ...(optStr(o, 'matchedFrom') !== undefined ? { matchedFrom: optStr(o, 'matchedFrom') } : {}),
  }
}

const edgeParsers: { [T in EdgeType]: (o: JsonObject) => EdgeTypeMetadataMap[T] } = {
  renders: (o) => ({
    ...(optNum(o, 'jsxLine') !== undefined ? { jsxLine: optNum(o, 'jsxLine') } : {}),
  }),
  navigates_to: (o) => ({
    method: str(o, 'method'),
  }),
  calls_api: parseCallsApi,
  handles: (o) => ({
    ...(optStr(o, 'handlerName') !== undefined ? { handlerName: optStr(o, 'handlerName') } : {}),
  }),
  calls_service: (o) => ({
    ...(optStr(o, 'serviceName') !== undefined ? { serviceName: optStr(o, 'serviceName') } : {}),
    ...(optNum(o, 'callLine') !== undefined ? { callLine: optNum(o, 'callLine') } : {}),
  }),
  queries_db: (o) => ({
    ...(optStr(o, 'operation') !== undefined ? { operation: optStr(o, 'operation') } : {}),
    ...(optNum(o, 'callLine') !== undefined ? { callLine: optNum(o, 'callLine') } : {}),
    ...(optStr(o, 'repository') !== undefined ? { repository: optStr(o, 'repository') } : {}),
  }),
  db_relation: (o) => ({
    relationType: literal(
      o,
      'relationType',
      'one_to_many',
      'one_to_one',
      'many_to_many',
      'many_to_one',
    ),
    relationName: str(o, 'relationName'),
    ...(optStr(o, 'fieldName') !== undefined ? { fieldName: optStr(o, 'fieldName') } : {}),
  }),
  imports: (o) => ({
    importPath: str(o, 'importPath'),
    importedNames: strArr(o, 'importedNames'),
    isTypeOnly: bool(o, 'isTypeOnly'),
  }),
  contains: (o) => ({
    ...(optStr(o, 'reason') !== undefined
      ? { reason: literal(o, 'reason', 'manual', 'route_prefix', 'directory') }
      : {}),
    ...(optStr(o, 'routerName') !== undefined ? { routerName: optStr(o, 'routerName') } : {}),
    ...(optStr(o, 'procedureName') !== undefined
      ? { procedureName: optStr(o, 'procedureName') }
      : {}),
  }),
  kotlin_inherits: (o) => ({
    superClass: str(o, 'superClass'),
    line: num(o, 'line'),
  }),
  kotlin_implements: (o) => ({
    interfaceName: str(o, 'interfaceName'),
    line: num(o, 'line'),
  }),
  kotlin_uses: (o) => ({
    usageType: literal(o, 'usageType', 'field', 'parameter', 'return', 'annotation'),
    line: num(o, 'line'),
  }),
  data_flows_to: (o) => ({
    typeName: str(o, 'typeName'),
    transferMethod: literal(
      o,
      'transferMethod',
      'return_type',
      'prop_type',
      'hook_data',
      'prisma_result',
    ),
  }),
  sends_msg: (o) =>
    'callType' in o
      ? parseCallsApi(o)
      : { msgName: str(o, 'msgName'), callLine: num(o, 'callLine') },
  listens_msg: (o) =>
    'callType' in o
      ? parseCallsApi(o)
      : { msgName: str(o, 'msgName'), callLine: num(o, 'callLine') },
  tests: (o) => ({
    relation: literal(o, 'relation', 'contains_case', 'declares_target'),
  }),
  covers: (o) => ({
    evidence: literal(
      o,
      'evidence',
      'direct_import',
      'direct_call',
      'route_reference',
      'source_mapping',
    ),
  }),
  uses_fixture: (o) => ({
    usage: literal(o, 'usage', 'lexical_scope', 'parameter', 'explicit_call'),
  }),
}
