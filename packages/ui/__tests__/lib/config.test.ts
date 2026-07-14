/**
 * UI 配置常量测试
 */

import { describe, it, expect } from 'vitest'
import { NODE_EMOJI, NODE_TYPE_LIST } from '../../src/lib/nodeConfig'
import { EDGE_TYPE_LIST } from '../../src/lib/edgeConfig'
import type { NodeType, EdgeType } from '@codeomnivis/shared'

const ALL_NODE_TYPES: NodeType[] = [
  'page', 'component', 'api_route', 'trpc_procedure',
  'tsrpc_service', 'tsrpc_api', 'tsrpc_msg',
  'express_route', 'handler', 'service', 'db_model', 'module',
  'kotlin_class', 'kotlin_interface', 'kotlin_object', 'kotlin_function', 'kotlin_route',
  'test_suite', 'test_case', 'test_fixture',
]

const ALL_EDGE_TYPES: EdgeType[] = [
  'renders', 'navigates_to', 'calls_api', 'handles',
  'calls_service', 'queries_db', 'db_relation', 'imports', 'contains',
  'kotlin_inherits', 'kotlin_implements', 'kotlin_uses', 'data_flows_to',
  'sends_msg', 'listens_msg',
  'tests', 'covers', 'uses_fixture',
]

describe('NODE_EMOJI', () => {
  it('包含所有 NodeType', () => {
    for (const type of ALL_NODE_TYPES) {
      expect(NODE_EMOJI[type]).toBeDefined()
      expect(typeof NODE_EMOJI[type]).toBe('string')
    }
  })

  it('数量正确', () => {
    expect(Object.keys(NODE_EMOJI)).toHaveLength(ALL_NODE_TYPES.length)
  })
})

describe('NODE_TYPE_LIST', () => {
  it('包含所有 NodeType', () => {
    for (const type of ALL_NODE_TYPES) {
      expect(NODE_TYPE_LIST).toContain(type)
    }
  })

  it('数量正确', () => {
    expect(NODE_TYPE_LIST).toHaveLength(ALL_NODE_TYPES.length)
  })
})

describe('EDGE_TYPE_LIST', () => {
  it('包含所有 EdgeType', () => {
    for (const type of ALL_EDGE_TYPES) {
      expect(EDGE_TYPE_LIST).toContain(type)
    }
  })

  it('数量正确', () => {
    expect(EDGE_TYPE_LIST).toHaveLength(ALL_EDGE_TYPES.length)
  })
})
