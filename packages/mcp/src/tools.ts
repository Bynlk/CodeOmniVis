import { DataFlowTracer, type OmniDatabase } from '@codeomnivis/analyzer'
import type { EdgeType, NodeType, OmniNode } from '@codeomnivis/shared'
import { isJsonObject, isNodeOfType } from '@codeomnivis/shared'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const API_NODE_TYPES: NodeType[] = [
  'api_route',
  'trpc_procedure',
  'express_route',
  'tsrpc_api',
  'tsrpc_service',
]
const API_DOWNSTREAM_EDGE_TYPES: EdgeType[] = ['handles', 'calls_service', 'queries_db']
const API_CALLER_EDGE_TYPES: EdgeType[] = ['calls_api']
const CALL_CHAIN_EDGE_TYPES: EdgeType[] = ['calls_api', 'handles', 'calls_service', 'queries_db']
const RENDERS_EDGE_TYPE: EdgeType = 'renders'
const DB_MODEL_NODE_TYPE: NodeType = 'db_model'
const MAX_COMPONENT_TREE_DEPTH = 100

type DepthResult = { ok: true; value: number } | { ok: false; message: string }

function stringArg(args: unknown, key: string): string | undefined {
  if (!isJsonObject(args)) return undefined
  const value = args[key]
  return typeof value === 'string' ? value : undefined
}

export function validateDepth(args: unknown, fallback: number): DepthResult {
  const raw = isJsonObject(args) ? args.depth : undefined
  if (raw === undefined || raw === null) return { ok: true, value: fallback }

  let value: number
  if (typeof raw === 'number') {
    value = raw
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    value = Number(raw)
  } else {
    return {
      ok: false,
      message: `depth must be a non-negative integer, got: ${JSON.stringify(raw)}`,
    }
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, message: `depth must be a finite integer, got: ${JSON.stringify(raw)}` }
  }
  if (value < 0) return { ok: false, message: `depth must be >= 0, got: ${value}` }
  if (value > MAX_COMPONENT_TREE_DEPTH) {
    return {
      ok: false,
      message: `depth exceeds maximum ${MAX_COMPONENT_TREE_DEPTH}, got: ${value}`,
    }
  }
  return { ok: true, value }
}

function getRouteDisplay(node: OmniNode): { method: string; path: string } {
  if (isNodeOfType(node, 'api_route')) {
    return { method: node.metadata.method, path: node.metadata.route }
  }
  if (isNodeOfType(node, 'express_route')) {
    return { method: node.metadata.method, path: node.metadata.route }
  }
  if (isNodeOfType(node, 'trpc_procedure')) {
    return { method: node.metadata.procedureType.toUpperCase(), path: node.name }
  }
  if (isNodeOfType(node, 'tsrpc_api')) {
    return { method: node.metadata.transport.toUpperCase(), path: node.metadata.apiPath }
  }
  if (isNodeOfType(node, 'tsrpc_service')) {
    return { method: node.metadata.transport.toUpperCase(), path: node.metadata.servicePath }
  }
  return { method: 'UNKNOWN', path: node.name }
}

function getNodeRoute(node: OmniNode): string {
  if (isNodeOfType(node, 'page')) return node.metadata.route
  if (isNodeOfType(node, 'api_route')) return node.metadata.route
  if (isNodeOfType(node, 'express_route')) return node.metadata.route
  return node.name
}

function success(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function errorResponse(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}

export function handleGetApiRoutes(db: OmniDatabase, args: unknown): CallToolResult {
  const filter = stringArg(args, 'filter')?.toLowerCase()
  const apiNodes = db.getNodesByTypes(API_NODE_TYPES)
  const filtered = filter
    ? apiNodes.filter((node) => {
        if (node.name.toLowerCase().includes(filter)) return true
        return getRouteDisplay(node).path.toLowerCase().includes(filter)
      })
    : apiNodes

  const routes = filtered.map((node) => {
    const { method, path } = getRouteDisplay(node)
    const downstream = db.getDownstreamNodes(node.id, API_DOWNSTREAM_EDGE_TYPES)
    const callers = db.getUpstreamNodes(node.id, API_CALLER_EDGE_TYPES)
    return {
      id: node.id,
      method,
      path,
      file: node.filePath,
      line: node.line,
      calledBy: callers.map((caller) => ({ id: caller.id, name: caller.name, type: caller.type })),
      dbOperations: downstream
        .filter((candidate) => candidate.type === 'db_model')
        .map((model) => ({ model: model.name, file: model.filePath })),
    }
  })

  return success({ routes, totalCount: routes.length })
}

export function handleGetComponentTree(db: OmniDatabase, args: unknown): CallToolResult {
  const rootPath = stringArg(args, 'rootPath')
  if (!rootPath) return errorResponse('rootPath is required')

  const depthResult = validateDepth(args, 3)
  if (!depthResult.ok) return errorResponse(depthResult.message)

  const rootNode = db.findNodeByRoute(rootPath) ?? db.findNodeByFilePath(rootPath)
  if (!rootNode) {
    return success({
      error: `No node found for: ${rootPath}`,
      suggestion: 'Try with a file path like "app/booking/page.tsx" or a route like "/booking"',
    })
  }

  const tree = db.getSubtree(rootNode.id, RENDERS_EDGE_TYPE, depthResult.value)
  if (tree === null) {
    return success({
      error: `No node found for: ${rootPath}`,
      suggestion: 'Try with a file path like "app/booking/page.tsx" or a route like "/booking"',
    })
  }
  if (tree.children.length === 0) {
    return success({ root: rootNode.name, children: [], message: 'No child components found' })
  }
  return success(tree)
}

export function handleFindCallers(db: OmniDatabase, args: unknown): CallToolResult {
  const target = stringArg(args, 'target')
  if (!target) return errorResponse('target is required')

  const targetNode = db.findNodeByAny(target)
  if (!targetNode) {
    return success({
      error: `Not found: ${target}`,
      suggestion: 'Try with a model name like "User" or a route like "/api/booking"',
    })
  }

  const callers = db.getUpstreamNodes(targetNode.id, CALL_CHAIN_EDGE_TYPES)
  const affectedPages = db.getAffectedPages(targetNode.id)
  return success({
    target: targetNode.name,
    targetType: targetNode.type,
    file: targetNode.filePath,
    callers: callers.map((caller) => ({
      id: caller.id,
      type: caller.type,
      name: caller.name,
      file: caller.filePath,
    })),
    affectedFrontendPages: affectedPages.map((page) => ({
      name: page.name,
      route: getNodeRoute(page),
      file: page.filePath,
    })),
  })
}

export function handleListDbModels(db: OmniDatabase): CallToolResult {
  const models = db.getNodesByType(DB_MODEL_NODE_TYPE)
  return success({
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      file: model.filePath,
      tableName: isNodeOfType(model, 'db_model') ? model.metadata.tableName : model.name,
      fieldCount: isNodeOfType(model, 'db_model') ? model.metadata.fieldCount : 0,
    })),
    totalCount: models.length,
  })
}

export function handleGetDataFlow(db: OmniDatabase, args: unknown): CallToolResult {
  const graph = db.loadGraph()
  const tracer = new DataFlowTracer(graph)
  const modelName = stringArg(args, 'model')

  if (modelName) {
    const modelNode = graph.nodes.find(
      (node) => node.type === 'db_model' && node.name.toLowerCase() === modelName.toLowerCase(),
    )
    if (!modelNode) {
      return success({
        error: `Model not found: ${modelName}`,
        availableModels: graph.nodes
          .filter((node) => node.type === 'db_model')
          .map((node) => node.name),
      })
    }

    const path = tracer.traceModelFlow(modelNode)
    return success({
      model: modelNode.name,
      routes: path.apiNodes.map((node) => ({ name: node.name, file: node.filePath })),
      components: path.componentNodes.map((node) => ({ name: node.name, file: node.filePath })),
      summary: `${modelNode.name} → ${path.apiNodes.length} routes → ${path.componentNodes.length} components`,
    })
  }

  const results = tracer.traceAllModels()
  return success({
    models: results.map((result) => ({
      name: result.modelName,
      routes: result.totalRoutes,
      components: result.totalComponents,
      summary: `${result.modelName} → ${result.totalRoutes} routes → ${result.totalComponents} components`,
    })),
    totalCount: results.length,
  })
}
