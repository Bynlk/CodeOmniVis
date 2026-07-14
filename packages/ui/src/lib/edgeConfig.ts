import type { EdgeType } from '@codeomnivis/shared'

/**
 * 边类型单一真源(feature-011)。
 * 颜色与画布 (utils/cytoscapeConfig) 取自同一处 —— cytoscapeConfig 反向读取 EDGE_COLORS,
 * 图例 (Legend) 亦读取本文件,保证颜色/emoji/顺序三处一致,杜绝漂移。
 */

export const EDGE_TYPE_LIST: EdgeType[] = [
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

/** 边线颜色 —— 画布与图例的单一真源。 */
export const EDGE_COLORS: Record<EdgeType, string> = {
  renders:           '#06b6d4',
  navigates_to:      '#8b5cf6',
  calls_api:         '#10b981',
  handles:           '#f59e0b',
  calls_service:     '#ef4444',
  queries_db:        '#ec4899',
  db_relation:       '#ec4899',
  imports:           '#475569',
  contains:          '#64748b',
  kotlin_inherits:   '#a855f7',
  kotlin_implements: '#3b82f6',
  kotlin_uses:       '#64748b',
  data_flows_to:     '#06b6d4',
  sends_msg:         '#f97316',
  listens_msg:       '#14b8a6',
  tests:             '#64748b',
  covers:            '#22c55e',
  uses_fixture:      '#f59e0b',
}

/** 边类型 emoji —— 图例展示用。 */
export const EDGE_EMOJI: Record<EdgeType, string> = {
  renders:           '🎨',
  navigates_to:      '🧭',
  calls_api:         '📡',
  handles:           '⚙️',
  calls_service:     '🔧',
  queries_db:        '🔍',
  db_relation:       '🗄️',
  imports:           '📥',
  contains:          '📦',
  kotlin_inherits:   '🧬',
  kotlin_implements: '🔷',
  kotlin_uses:       '🔗',
  data_flows_to:     '🌊',
  sends_msg:         '📨',
  listens_msg:       '📣',
  tests:             '🧪',
  covers:            '🎯',
  uses_fixture:      '🔩',
}
