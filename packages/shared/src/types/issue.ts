/**
 * OmniVis 一致性问题定义
 *
 * 用于前后端接口一致性检测的输出格式。
 */

// ============================================================
// 严重级别
// ============================================================

export type IssueSeverity = 'critical' | 'warning' | 'info'

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
  /** 相关位置 */
  locations: IssueLocation[]
  /** 相关节点 ID */
  relatedNodeIds: string[]
  /** 相关边 ID */
  relatedEdgeIds: string[]
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
