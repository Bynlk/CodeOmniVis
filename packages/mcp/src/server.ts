export const MCP_TOOL_NAMES = {
  getApiRoutes: 'get_api_routes',
  getComponentTree: 'get_component_tree',
  findCallers: 'find_callers',
  listDbModels: 'list_db_models',
  getDataflow: 'get_dataflow',
} as const

export const PUBLIC_TOOL_NAMES = Object.freeze(Object.values(MCP_TOOL_NAMES))
