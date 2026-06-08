import type { EdgeType } from '@codeomnivis/shared'

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
]
