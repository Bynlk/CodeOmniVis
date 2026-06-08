import type { NodeType } from '@codeomnivis/shared'
import { NODE_COLORS } from '@codeomnivis/shared'

export { NODE_COLORS }

export const NODE_EMOJI: Record<NodeType, string> = {
  page:             '📄',
  component:        '🧩',
  api_route:        '🔗',
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

export const NODE_TYPE_LIST = Object.keys(NODE_EMOJI) as NodeType[]
