/**
 * CodeOmniVis 边类型定义
 *
 * 所有解析器输出的边必须符合 OmniEdge 接口。
 * 边 ID 格式：{sourceId}--{type}--{targetId}
 */

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
  /** 子组件在 JSX 中的位置 */
  jsxLine: number
}

export interface NavigatesToMetadata {
  /** 导航方式：Link / router.push / redirect */
  method: string
}

export interface CallsApiMetadata {
  /** HTTP method（fetch/axios 时） */
  method?: string
  /** 调用方式：fetch / axios / trpc_hook */
  callType: 'fetch' | 'axios' | 'trpc_hook'
  /** 调用位置 */
  callLine: number
}

export interface HandlesMetadata {
  /** handler 函数名 */
  handlerName: string
}

export interface CallsServiceMetadata {
  /** service 函数名 */
  serviceName: string
  /** 调用位置 */
  callLine: number
}

export interface QueriesDbMetadata {
  /** Prisma/TypeORM 操作类型 */
  operation: string
  /** 调用位置 */
  callLine: number
}

export interface DbRelationMetadata {
  /** 关系类型 */
  relationType: 'one_to_one' | 'one_to_many' | 'many_to_many'
  /** 关系字段名 */
  fieldName: string
  /** Prisma relation name */
  relationName: string
}

export interface ContainsMetadata {
  /** 聚合原因 */
  reason: 'route_prefix' | 'directory' | 'manual'
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

// ============================================================
// Metadata 联合类型
// ============================================================

export type EdgeMetadata =
  | RendersMetadata
  | NavigatesToMetadata
  | CallsApiMetadata
  | HandlesMetadata
  | CallsServiceMetadata
  | QueriesDbMetadata
  | DbRelationMetadata
  | ContainsMetadata
  | KotlinInheritsMetadata
  | KotlinImplementsMetadata
  | KotlinUsesMetadata
  | Record<string, unknown>

// ============================================================
// 核心边接口
// ============================================================

export interface OmniEdge {
  /** 唯一 ID，格式：{sourceId}--{type}--{targetId} */
  id: string
  /** 源节点 ID */
  source: string
  /** 目标节点 ID */
  target: string
  /** 边类型 */
  type: EdgeType
  /** 置信度 */
  confidence: EdgeConfidence
  /** 类型特定的额外信息 */
  metadata: EdgeMetadata
}

// ============================================================
// 工具函数
// ============================================================

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
  return {
    source: match[1],
    type: match[2] as EdgeType,
    target: match[3],
  }
}
