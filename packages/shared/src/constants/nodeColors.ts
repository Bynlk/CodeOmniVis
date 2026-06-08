/**
 * 节点类型 → 颜色映射
 *
 * 颜色系统参考 Linear/Figma 风格，深色背景下的配色。
 * 与 UI 包中的 theme.ts 保持一致。
 */

import type { NodeType } from '../types/node'

export const NODE_COLORS: Record<NodeType, string> = {
  page:             '#6366f1',  // 紫色 - 页面路由
  component:        '#3b82f6',  // 蓝色 - 组件
  api_route:        '#10b981',  // 绿色 - API 路由
  trpc_procedure:   '#06b6d4',  // 青色 - tRPC
  tsrpc_service:    '#14b8a6',  // 青绿色 - TSRPC
  tsrpc_api:        '#0d9488',  // 深青色 - TSRPC API
  tsrpc_msg:        '#2dd4bf',  // 浅青色 - TSRPC Msg
  express_route:    '#f59e0b',  // 橙色 - Express
  handler:          '#f59e0b',  // 橙色 - Handler
  service:          '#8b5cf6',  // 紫色 - Service
  db_model:         '#ec4899',  // 粉色 - DB 模型
  module:           '#374151',  // 灰色 - 聚合模块
  kotlin_class:     '#a855f7',  // 紫色 - Kotlin Class
  kotlin_interface: '#3b82f6',  // 蓝色 - Kotlin Interface
  kotlin_object:    '#f97316',  // 橙色 - Kotlin Object
  kotlin_function:  '#22c55e',  // 绿色 - Kotlin Function
  kotlin_route:     '#eab308',  // 黄色 - Kotlin Route
}

/** 节点类型 → 半透明颜色（用于边） */
export const NODE_COLORS_ALPHA: Record<NodeType, string> = {
  page:             '#6366f140',
  component:        '#3b82f640',
  api_route:        '#10b98140',
  trpc_procedure:   '#06b6d440',
  tsrpc_service:    '#14b8a640',
  tsrpc_api:        '#0d948840',
  tsrpc_msg:        '#2dd4bf40',
  express_route:    '#f59e0b40',
  handler:          '#f59e0b40',
  service:          '#8b5cf640',
  db_model:         '#ec489940',
  module:           '#37415140',
  kotlin_class:     '#a855f740',
  kotlin_interface: '#3b82f640',
  kotlin_object:    '#f9731640',
  kotlin_function:  '#22c55e40',
  kotlin_route:     '#eab30840',
}

/** 节点类型 → 图标（emoji，用于 CLI 输出） */
export const NODE_ICONS: Record<NodeType, string> = {
  page:             '📄',
  component:        '🧩',
  api_route:        '🌐',
  trpc_procedure:   '⚡',
  tsrpc_service:    '🔗',
  tsrpc_api:        '🔌',
  tsrpc_msg:        '📨',
  express_route:    '🚂',
  handler:          '⚙️',
  service:          '🔧',
  db_model:         '🗄️',
  module:           '📦',
  kotlin_class:     '🟣',
  kotlin_interface: '🔷',
  kotlin_object:    '🟠',
  kotlin_function:  '🟢',
  kotlin_route:     '🟡',
}
