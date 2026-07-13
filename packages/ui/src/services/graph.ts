/**
 * 图数据领域服务（feature-001-service-layer）。
 * 封装所有 /api/graph* 端点；URL/method 与重构前逐一对齐。
 */

import type {
  IssueDetectorStatus,
  IssueLocation,
  SourcedIssue,
  OmniGraph,
  TraceResult,
} from '@codeomnivis/shared'
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

// ---- GET /api/graph/issues ----
export interface GraphIssuesResult {
  issues: SourcedIssue[]
  summary: {
    total: number
    critical: number
    warning: number
    info: number
  }
  detectors: IssueDetectorStatus[]
}

const ISSUE_SOURCES = new Set(['consistency', 'security', 'performance', 'framework'])
const ISSUE_SEVERITIES = new Set(['critical', 'warning', 'info'])
const ISSUE_TYPES = new Set([
  'dead_api_call', 'unused_route', 'method_mismatch', 'missing_procedure',
  'param_mismatch', 'dead_route', 'dead_component', 'dead_service',
  'circular_dependency', 'n_plus_one_query', 'unguarded_route',
  'rsc_boundary_violation',
])
const ISSUE_MESSAGE_KEYS = new Set([
  'dead_api_call', 'unused_route', 'orphan_node', 'method_mismatch',
  'missing_procedure', 'param_mismatch', 'dead_route', 'dead_component',
  'dead_service', 'circular_dependency', 'n_plus_one_query',
  'unguarded_route', 'rsc_boundary_violation',
])
const DETECTOR_IDS = new Set(['consistency', 'auth', 'n_plus_one', 'rsc'])

function isIssueLocation(value: unknown): value is IssueLocation {
  return isJsonObject(value)
    && typeof value.file === 'string'
    && (value.line === undefined || typeof value.line === 'number')
    && (value.note === undefined || typeof value.note === 'string')
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function hasValidStructuredMessage(value: Record<string, unknown>): boolean {
  if (value.messageKey === undefined && value.messageParams === undefined) return true
  if (typeof value.messageKey !== 'string' || !ISSUE_MESSAGE_KEYS.has(value.messageKey)) return false
  if (value.messageParams === undefined) return true
  return isJsonObject(value.messageParams)
    && Object.values(value.messageParams).every(param => (
      typeof param === 'string' || typeof param === 'number'
    ))
}

function isSourcedIssue(value: unknown): value is SourcedIssue {
  return isJsonObject(value)
    && typeof value.id === 'string'
    && typeof value.source === 'string'
    && ISSUE_SOURCES.has(value.source)
    && typeof value.severity === 'string'
    && ISSUE_SEVERITIES.has(value.severity)
    && typeof value.type === 'string'
    && ISSUE_TYPES.has(value.type)
    && typeof value.description === 'string'
    && hasValidStructuredMessage(value)
    && Array.isArray(value.locations)
    && value.locations.every(isIssueLocation)
    && isStringArray(value.relatedNodeIds)
    && isStringArray(value.relatedEdgeIds)
}

function isDetectorStatus(value: unknown): value is IssueDetectorStatus {
  return isJsonObject(value)
    && typeof value.id === 'string'
    && DETECTOR_IDS.has(value.id)
    && (value.status === 'complete' || value.status === 'failed')
    && (value.message === undefined || typeof value.message === 'string')
}

export async function getGraphIssues(): Promise<GraphIssuesResult> {
  const json = await requestJson('/api/graph/issues')
  if (!isJsonObject(json) || !Array.isArray(json.data) || !isJsonObject(json.meta)) {
    throw new Error('Invalid graph issues response')
  }

  const issues = (json.data as unknown[]).filter(isSourcedIssue)
  const { meta } = json
  const detectorValues: unknown[] = Array.isArray(meta.detectors) ? meta.detectors : []
  const detectors = detectorValues.filter(isDetectorStatus)
  const detectorIds = new Set(detectors.map(detector => detector.id))
  const critical = issues.filter(issue => issue.severity === 'critical').length
  const warning = issues.filter(issue => issue.severity === 'warning').length
  const info = issues.filter(issue => issue.severity === 'info').length
  const validMeta = typeof meta.count === 'number'
    && typeof meta.total === 'number'
    && typeof meta.critical === 'number'
    && typeof meta.warning === 'number'
    && typeof meta.info === 'number'
    && meta.count === issues.length
    && meta.total === meta.count
    && detectors.length === 4
    && detectorIds.size === 4
    && meta.critical === critical
    && meta.warning === warning
    && meta.info === info

  if (!validMeta) throw new Error('Invalid graph issues response')

  return {
    issues,
    summary: {
      total: meta.total as number,
      critical: meta.critical as number,
      warning: meta.warning as number,
      info: meta.info as number,
    },
    detectors,
  }
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
