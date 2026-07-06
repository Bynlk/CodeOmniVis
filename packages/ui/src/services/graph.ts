/**
 * 图数据领域服务（feature-001-service-layer）。
 * 封装所有 /api/graph* 端点；URL/method 与重构前逐一对齐。
 */

import type { OmniGraph, TraceResult } from '@codeomnivis/shared'
import { isJsonObject, isTraceResult } from '@codeomnivis/shared'
import { requestJson, unwrap } from './client'

// ---- GET /api/graph ----
export interface GraphResponse {
  data: OmniGraph
  meta: {
    nodeCount: number
    edgeCount: number
    nodesByType: Record<string, number>
    edgesByType: Record<string, number>
  }
}

function isGraphResponse(value: unknown): value is GraphResponse {
  return isJsonObject(value) && isJsonObject(value.data) && isJsonObject(value.meta)
}

export async function getGraph(signal?: AbortSignal): Promise<GraphResponse> {
  const json = await requestJson('/api/graph', signal ? { signal } : undefined)
  if (!isGraphResponse(json)) throw new Error('Invalid graph response')
  return json
}

// ---- GET /api/graph/stats ----
export interface StatsResponse {
  nodeCount: number
  edgeCount: number
  errorCount: number
  nodeTypeCounts: Record<string, number>
  edgeTypeCounts: Record<string, number>
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return typeof value === 'object' && value !== null
    && Object.values(value).every(item => typeof item === 'number')
}

function isStatsResponse(value: unknown): value is StatsResponse {
  return isJsonObject(value)
    && typeof value.nodeCount === 'number'
    && typeof value.edgeCount === 'number'
    && typeof value.errorCount === 'number'
    && isNumberRecord(value.nodeTypeCounts)
    && isNumberRecord(value.edgeTypeCounts)
}

export async function getGraphStats(): Promise<StatsResponse> {
  const json = await requestJson('/api/graph/stats')
  const data = unwrap(json)
  if (!isStatsResponse(data)) throw new Error('Invalid stats response')
  return data
}

// ---- GET /api/graph/errors ----
export interface ParseError {
  file: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

function isParseError(value: unknown): value is ParseError {
  return isJsonObject(value)
    && typeof value.file === 'string'
    && typeof value.message === 'string'
    && (value.severity === 'error' || value.severity === 'warning' || value.severity === 'info')
}

export async function getGraphErrors(): Promise<ParseError[]> {
  const json = await requestJson('/api/graph/errors')
  const data = unwrap(json)
  return Array.isArray(data) ? data.filter(isParseError) : []
}

// ---- GET /api/graph/nodes?type= ----
export interface NodeOption {
  id: string
  name: string
}

function isNodeOption(value: unknown): value is NodeOption {
  return isJsonObject(value) && typeof value.id === 'string' && typeof value.name === 'string'
}

export async function getGraphNodes(type: string): Promise<NodeOption[]> {
  const json = await requestJson(`/api/graph/nodes?type=${encodeURIComponent(type)}`)
    .catch(() => undefined)
  const data = unwrap(json)
  return Array.isArray(data)
    ? data.filter(isNodeOption).map(n => ({ id: n.id, name: n.name }))
    : []
}

// ---- GET /api/graph/dataflow[?model=] ----
export interface DataFlowPath {
  modelNode: { id: string; name: string; type: string }
  apiNodes: { id: string; name: string; type: string }[]
  componentNodes: { id: string; name: string; type: string }[]
}
export interface DataFlowResult {
  modelId: string
  modelName: string
  paths: DataFlowPath[]
  totalRoutes: number
  totalComponents: number
}

function isDataFlowResult(value: unknown): value is DataFlowResult {
  return isJsonObject(value) && typeof value.modelId === 'string' && Array.isArray(value.paths)
}

export async function getGraphDataflow(model?: string): Promise<DataFlowResult[]> {
  const url = model
    ? `/api/graph/dataflow?model=${encodeURIComponent(model)}`
    : '/api/graph/dataflow'
  const json = await requestJson(url)
  const data = unwrap(json)
  if (data === undefined || data === null) return []
  if (Array.isArray(data)) return data.filter(isDataFlowResult)
  return isDataFlowResult(data) ? [data] : []
}

// ---- GET /api/graph/trace?node= ----
export async function getTrace(nodeId: string): Promise<TraceResult> {
  const json = await requestJson(`/api/graph/trace?node=${encodeURIComponent(nodeId)}`)
  const data = isJsonObject(json) ? json.data : undefined
  if (!isTraceResult(data)) throw new Error('Invalid trace response')
  return data
}
