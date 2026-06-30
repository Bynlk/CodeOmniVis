/**
 * 数据新鲜度契约。
 *
 * 描述当前图数据相对于源代码的新鲜度状态,跨 HTTP / WebSocket 边界传输。
 * - fresh:    图数据已反映最新源代码
 * - analyzing:正在重新分析
 * - stale:    源代码已变更,图数据待刷新
 */

import { isJsonObject } from './json'

export type FreshnessState = 'fresh' | 'analyzing' | 'stale'

export interface FreshnessStatus {
  /** 当前新鲜度状态 */
  state: FreshnessState
  /** 上次成功分析完成时间(epoch ms);从未分析过为 null */
  lastAnalyzedAt: number | null
  /** 自上次分析以来累计的未处理文件变更数 */
  pendingChanges: number
}

/** 是否为合法的新鲜度状态字面量(无类型断言)。 */
export function isFreshnessState(value: unknown): value is FreshnessState {
  return value === 'fresh' || value === 'analyzing' || value === 'stale'
}

/** 在边界处把 unknown(HTTP/WS 输入)收敛为 FreshnessStatus。 */
export function isFreshnessStatus(value: unknown): value is FreshnessStatus {
  if (!isJsonObject(value)) return false
  const { state, lastAnalyzedAt, pendingChanges } = value
  if (!isFreshnessState(state)) return false
  if (!(lastAnalyzedAt === null || typeof lastAnalyzedAt === 'number')) return false
  if (typeof pendingChanges !== 'number') return false
  return true
}
