/**
 * 全链路追踪契约。
 *
 * 从任意节点出发,双向(上游 + 下游)遍历图,产出一条有序的"链路站点"序列。
 * 每个站点对应一个节点,带分层泳道归属、与前一站的连接边类型、自动说明文本。
 * 跨 HTTP 边界以 unknown 进入,经 guard 收敛。
 */

import { isJsonObject } from './json'
import { isNodeType, type NodeType } from './node'
import { isEdgeType, type EdgeType } from './edge'

/** 分层泳道(从前端到数据,自上而下)。 */
export type TraceLayer = 'frontend' | 'api' | 'logic' | 'data' | 'other'

export const TRACE_LAYER_ORDER: readonly TraceLayer[] = [
  'frontend',
  'api',
  'logic',
  'data',
  'other',
]

/** 单个链路站点。 */
export interface TraceStep {
  /** 第几站(从 1 开始,沿链路递增) */
  index: number
  /** 节点 ID */
  nodeId: string
  /** 节点显示名 */
  nodeName: string
  /** 节点类型 */
  nodeType: NodeType
  /** 所属泳道 */
  layer: TraceLayer
  /** 文件路径 */
  filePath: string
  /** 行号 */
  line: number
  /** 与上一站相连的边类型(首站为 null) */
  edgeFromPrev: EdgeType | null
  /** 自动说明(静态优先) */
  explanation: string
}

/** 一次链路追踪结果。 */
export interface TraceResult {
  /** 起点节点 ID */
  rootId: string
  /** 有序站点序列(上游 → 起点 → 下游) */
  steps: TraceStep[]
  /** 站点总数 */
  totalSteps: number
}

/** 把任意节点类型映射到泳道。 */
export function traceLayerForNodeType(type: NodeType): TraceLayer {
  switch (type) {
    case 'page':
    case 'component':
      return 'frontend'
    case 'api_route':
    case 'trpc_procedure':
    case 'tsrpc_service':
    case 'tsrpc_api':
    case 'tsrpc_msg':
    case 'express_route':
    case 'kotlin_route':
      return 'api'
    case 'handler':
    case 'service':
      return 'logic'
    case 'db_model':
      return 'data'
    case 'module':
    case 'kotlin_class':
    case 'kotlin_interface':
    case 'kotlin_object':
    case 'kotlin_function':
    case 'test_suite':
    case 'test_case':
    case 'test_fixture':
      return 'other'
  }
}

/** 是否为合法泳道。 */
export function isTraceLayer(value: unknown): value is TraceLayer {
  return (
    value === 'frontend' ||
    value === 'api' ||
    value === 'logic' ||
    value === 'data' ||
    value === 'other'
  )
}

/** unknown → TraceStep 收敛。 */
export function isTraceStep(value: unknown): value is TraceStep {
  if (!isJsonObject(value)) return false
  const { index, nodeId, nodeName, nodeType, layer, filePath, line, edgeFromPrev, explanation } = value
  if (typeof index !== 'number') return false
  if (typeof nodeId !== 'string') return false
  if (typeof nodeName !== 'string') return false
  if (typeof nodeType !== 'string' || !isNodeType(nodeType)) return false
  if (!isTraceLayer(layer)) return false
  if (typeof filePath !== 'string') return false
  if (typeof line !== 'number') return false
  if (!(edgeFromPrev === null || (typeof edgeFromPrev === 'string' && isEdgeType(edgeFromPrev)))) return false
  if (typeof explanation !== 'string') return false
  return true
}

/** unknown → TraceResult 收敛。 */
export function isTraceResult(value: unknown): value is TraceResult {
  if (!isJsonObject(value)) return false
  const { rootId, steps, totalSteps } = value
  if (typeof rootId !== 'string') return false
  if (typeof totalSteps !== 'number') return false
  if (!Array.isArray(steps)) return false
  for (const step of steps) {
    if (!isTraceStep(step)) return false
  }
  return true
}
