/**
 * UI 配置常量测试
 */

import { describe, it, expect } from 'vitest'
import { NODE_EMOJI, NODE_TYPE_LIST } from '../../src/lib/nodeConfig'
import { EDGE_TYPE_LIST } from '../../src/lib/edgeConfig'
import { NODE_COLORS, type NodeType, type EdgeType } from '@codeomnivis/shared'
import type cytoscape from 'cytoscape'
import { getCytoscapeStyle } from '../../src/utils/cytoscapeConfig'

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

describe('getCytoscapeStyle', () => {
  it('defines a restrained style for every edge type', () => {
    const styles = getCytoscapeStyle()
    for (const type of ALL_EDGE_TYPES) {
      expect(styles).toContainEqual(expect.objectContaining({ selector: `edge[type="${type}"]` }))
    }
    expect(styles).toContainEqual(expect.objectContaining({ selector: 'edge[confidence="inferred"]' }))
  })

  it('derives safe node colors and compact labels from runtime data', () => {
    const nodeBlock = getCytoscapeStyle().find(style => style.selector === 'node')
    const nodeStyle = nodeBlock && 'style' in nodeBlock
      ? nodeBlock.style as cytoscape.Css.Node
      : undefined
    const borderColor = nodeStyle?.['border-color'] as (node: cytoscape.NodeSingular) => string
    const label = nodeStyle?.label as (node: cytoscape.NodeSingular) => string
    const node = (data: Record<string, unknown>) => ({
      data: (key: string) => data[key],
    }) as unknown as cytoscape.NodeSingular

    expect(borderColor(node({ type: 'test_case' }))).toBe(NODE_COLORS.test_case)
    expect(borderColor(node({ type: 'unknown' }))).toBe('#343e4d')
    expect(label(node({ label: 'A very long architecture node label' }))).toBe('A very long archit…')
    expect(label(node({ label: 'Short' }))).toBe('Short')
    expect(label(node({}))).toBe('?')
  })
})
