import { expect, it } from 'vitest'
import { PUBLIC_TOOL_NAMES } from '../../src/server'

it('keeps every existing MCP tool name', () => {
  expect([...PUBLIC_TOOL_NAMES]).toEqual(expect.arrayContaining([
    'find_callers',
    'get_api_routes',
    'get_component_tree',
    'get_dataflow',
    'list_db_models',
  ]))
})
