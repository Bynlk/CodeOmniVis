/**
 * CodeOmniVis 边类型定义
 *
 * 所有解析器输出的边必须符合 OmniEdge 接口。
 * 边 ID 格式：{sourceId}--{type}--{targetId}
 */

import type { CoversMetadata, TestsMetadata, UsesFixtureMetadata } from './test'

// ============================================================
// 边类型枚举
// ============================================================

export type EdgeType =
  | 'renders'         // 组件渲染关系：Parent → Child
  | 'navigates_to'    // 页面导航：Page A → Page B（通过 Link/router.push）
  | 'calls_api'       // 前端 API 调用：Component → API Route / tRPC Procedure
  | 'handles'         // 路由处理：API Route → Handler Function
  | 'calls_service'   // Handler → Service 调用
  | 'queries_db'      // Service/Handler → DB Model 查询
  | 'db_relation'     // DB 关系：Model A → Model B（一对多/多对多）
  | 'imports'         // 模块导入（用于解析但通常不直接显示）
  | 'contains'        // 聚合关系：Module → 其内部节点
  | 'kotlin_inherits' // Kotlin 类继承：Child → Parent
  | 'kotlin_implements' // Kotlin 接口实现：Class → Interface
  | 'kotlin_uses'     // Kotlin 依赖关系：Class → Class（字段/参数/返回值类型）
  | 'data_flows_to'   // 数据流：Model → API → Component 类型传播路径
  | 'sends_msg'       // client.sendMsg() / server.broadcast()
  | 'listens_msg'     // client.listenMsg() / server.addMsgListener()
  | 'tests'
  | 'covers'
  | 'uses_fixture'

const EDGE_TYPES: EdgeType[] = [
  'renders',
  'navigates_to',
  'calls_api',
  'handles',
  'calls_service',
  'queries_db',
  'db_relation',
  'imports',
  'contains',
  'kotlin_inherits',
  'kotlin_implements',
  'kotlin_uses',
  'data_flows_to',
  'sends_msg',
  'listens_msg',
  'tests',
  'covers',
  'uses_fixture',
]
const EDGE_TYPE_SET = new Set<string>(EDGE_TYPES)

// ============================================================
// 置信度
// ============================================================

/**
 * 边的置信度
 * - certain: 通过直接 import 或类型系统确认
 * - inferred: 通过模式匹配推断（可能有误）
 */
export type EdgeConfidence = 'certain' | 'inferred'

// ============================================================
// 各类型边的 Metadata
// ============================================================

export interface RendersMetadata {
  /** 子组件在 JSX 中的位置（推断渲染边可能未知） */
  jsxLine?: number
}

export interface NavigatesToMetadata {
  /** 导航方式：Link / router.push / redirect */
  method: string
}

export interface CallsApiMetadata {
  /** HTTP method（fetch/axios 时） */
  method?: string
  /** 调用方式：fetch / axios / trpc_hook / tsrpc_call_api / tsrpc_listen_msg */
  callType: 'fetch' | 'axios' | 'trpc_hook' | 'tsrpc_call_api' | 'tsrpc_listen_msg'
  /** 调用目标 URL、procedure 或 TSRPC service/msg 名称 */
  url?: string
  /** 调用位置 */
  callLine: number
  /** 跨层连线器匹配来源边 ID（resolver 补连时记录原始边） */
  matchedFrom?: string
}

export interface HandlesMetadata {
  /** handler 函数名（resolver 合成的 handles 边可能未知） */
  handlerName?: string
}

export interface CallsServiceMetadata {
  /** service 函数名（resolver 跨层补连时可能未知） */
  serviceName?: string
  /** 调用位置（跨文件推断边可能无具体行号） */
  callLine?: number
}

export interface QueriesDbMetadata {
  /** Prisma/TypeORM 操作类型 */
  operation?: string
  /** 调用位置 */
  callLine?: number
  /** NestJS @InjectRepository 注入的仓储类型 */
  repository?: string
}

export interface DbRelationMetadata {
  /** 关系类型 */
  relationType: 'one_to_one' | 'one_to_many' | 'many_to_many' | 'many_to_one'
  /** 关系字段名（Drizzle relations() 无单一字段名时省略） */
  fieldName?: string
  /** Prisma relation name */
  relationName: string
}

export interface ContainsMetadata {
  /** 聚合原因 */
  reason?: 'route_prefix' | 'directory' | 'manual'
  /** tRPC router 名称（router → procedure 聚合边） */
  routerName?: string
  /** tRPC procedure 名称 */
  procedureName?: string
}

export interface KotlinInheritsMetadata {
  superClass: string
  line: number
}

export interface KotlinImplementsMetadata {
  interfaceName: string
  line: number
}

export interface KotlinUsesMetadata {
  usageType: 'field' | 'parameter' | 'return' | 'annotation'
  line: number
}

export interface SendsMsgMetadata {
  /** 消息名称 */
  msgName: string
  /** 调用位置 */
  callLine: number
}

export interface ListensMsgMetadata {
  /** 消息名称 */
  msgName: string
  /** 调用位置 */
  callLine: number
}

export interface ImportsMetadata {
  /** 被导入模块的路径 */
  importPath: string
  /** 导入的符号名 */
  importedNames: string[]
  /** 是否是 type-only 导入 */
  isTypeOnly: boolean
}

export interface DataFlowsToMetadata {
  /** 流动的类型名（通常是 DB Model 名） */
  typeName: string
  /** 传播方式 */
  transferMethod: 'return_type' | 'prop_type' | 'hook_data' | 'prisma_result'
}

// ============================================================
// Metadata 联合类型
// ============================================================

export type EdgeMetadata = EdgeTypeMetadataMap[EdgeType]

// ============================================================
// 核心边接口
// ============================================================

/**
 * 由 `type` 字段驱动 `metadata` 的封闭边类型。
 */
export type TypedOmniEdge<T extends EdgeType> = {
  /** 唯一 ID，格式：{sourceId}--{type}--{targetId} */
  id: string
  /** 源节点 ID */
  source: string
  /** 目标节点 ID */
  target: string
  /** 边类型 */
  type: T
  /** 置信度 */
  confidence: EdgeConfidence
  /** 类型特定的额外信息 */
  metadata: EdgeTypeMetadataMap[T]
}

/** 所有边类型的判别联合（discriminated union）。 */
export type OmniEdge = {
  [T in EdgeType]: TypedOmniEdge<T>
}[EdgeType]

export type EdgeTypeMetadataMap = {
  renders: RendersMetadata
  navigates_to: NavigatesToMetadata
  calls_api: CallsApiMetadata
  handles: HandlesMetadata
  calls_service: CallsServiceMetadata
  queries_db: QueriesDbMetadata
  db_relation: DbRelationMetadata
  imports: ImportsMetadata
  contains: ContainsMetadata
  kotlin_inherits: KotlinInheritsMetadata
  kotlin_implements: KotlinImplementsMetadata
  kotlin_uses: KotlinUsesMetadata
  data_flows_to: DataFlowsToMetadata
  sends_msg: CallsApiMetadata | SendsMsgMetadata
  listens_msg: CallsApiMetadata | ListensMsgMetadata
  tests: TestsMetadata
  covers: CoversMetadata
  uses_fixture: UsesFixtureMetadata
}


// ============================================================
// 工具函数
// ============================================================

export function isEdgeType(value: string): value is EdgeType {
  return EDGE_TYPE_SET.has(value)
}

export function isEdgeOfType<T extends EdgeType>(
  edge: OmniEdge,
  type: T
): edge is Extract<OmniEdge, { type: T }> {
  return edge.type === type
}

/** 类型安全的边工厂：`type` 与 `metadata` 由编译器强制对应。 */
export function createTypedEdge<T extends EdgeType>(
  edge: TypedOmniEdge<T>
): TypedOmniEdge<T> {
  return edge
}

/** 生成边 ID */
export function createEdgeId(source: string, type: EdgeType, target: string): string {
  return `${source}--${type}--${target}`
}

/** 解析边 ID */
export function parseEdgeId(id: string): { source: string; type: EdgeType; target: string } {
  // 格式：{sourceId}--{type}--{targetId}
  // sourceId 和 targetId 可能包含 ':'，但 '--' 是分隔符
  const match = id.match(/^(.+?)--(\w+)--(.+)$/)
  if (!match) {
    throw new Error(`Invalid edge ID format: ${id}`)
  }
  if (!isEdgeType(match[2])) {
    throw new Error(`Invalid edge type in ID: ${id}`)
  }
  return {
    source: match[1],
    type: match[2],
    target: match[3],
  }
}
