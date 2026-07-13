/**
 * CodeOmniVis 一致性问题定义
 *
 * 用于前后端接口一致性检测的输出格式。
 */

// ============================================================
// 严重级别
// ============================================================

export type IssueSeverity = 'critical' | 'warning' | 'info'

/** Product-facing origin of a deterministic project issue. */
export type IssueSource = 'consistency' | 'security' | 'performance' | 'framework'

/** Stable detector identifiers used by the Web quality contract. */
export type IssueDetectorId = 'consistency' | 'auth' | 'n_plus_one' | 'rsc'

export interface IssueDetectorStatus {
  id: IssueDetectorId
  status: 'complete' | 'failed'
  message?: string
}

// ============================================================
// 问题类型
// ============================================================

export type IssueType =
  | 'dead_api_call'       // 前端调用了后端不存在的 API
  | 'unused_route'        // 后端定义了路由，前端未调用
  | 'method_mismatch'     // HTTP method 不匹配
  | 'missing_procedure'   // tRPC procedure 不存在
  | 'param_mismatch'      // 动态路由参数不一致
  | 'dead_route'          // API 路由没有前端调用
  | 'dead_component'      // 组件没有被渲染
  | 'dead_service'        // Service 没有被调用
  | 'circular_dependency' // 循环依赖
  | 'n_plus_one_query'    // N+1 查询：循环内的 DB 调用
  | 'unguarded_route'     // API 路由没有鉴权
  | 'rsc_boundary_violation' // RSC 边界违规

/** Stable presentation keys for localized deterministic detector descriptions. */
export type IssueMessageKey =
  | 'dead_api_call'
  | 'unused_route'
  | 'orphan_node'
  | 'method_mismatch'
  | 'missing_procedure'
  | 'param_mismatch'
  | 'dead_route'
  | 'dead_component'
  | 'dead_service'
  | 'circular_dependency'
  | 'n_plus_one_query'
  | 'unguarded_route'
  | 'rsc_boundary_violation'

export type IssueMessageParams = Record<string, string | number>

// ============================================================
// 问题位置
// ============================================================

export interface IssueLocation {
  file: string
  line?: number
  note?: string
}

// ============================================================
// 核心问题接口
// ============================================================

export interface Issue {
  /** 问题唯一 ID */
  id: string
  /** 严重级别 */
  severity: IssueSeverity
  /** 问题类型 */
  type: IssueType
  /** 问题描述 */
  description: string
  /** Optional structured presentation data; description remains the compatibility fallback. */
  messageKey?: IssueMessageKey
  messageParams?: IssueMessageParams
  /** 相关位置 */
  locations: IssueLocation[]
  /** 相关节点 ID */
  relatedNodeIds: string[]
  /** 相关边 ID */
  relatedEdgeIds: string[]
}

/** Issue enriched with the product category that produced it. */
export interface SourcedIssue extends Issue {
  source: IssueSource
}

// ============================================================
// 检测结果
// ============================================================

export interface ConsistencyReport {
  issues: Issue[]
  summary: {
    total: number
    critical: number
    warning: number
    info: number
  }
}
