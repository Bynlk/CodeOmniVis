import { isEdgeType, isJsonObject, isNodeType } from '@codeomnivis/shared'
import type { OmniEdge, OmniNode } from '@codeomnivis/shared'
import { requestJson, unwrap } from './client'

export interface TestsResponse {
  suites: OmniNode[]
  cases: OmniNode[]
  fixtures: OmniNode[]
  coverage: OmniEdge[]
  summary: {
    suites: number
    cases: number
    fixtures: number
    coveredTargets: number
    uncoveredTargets: number
    byFramework: Record<string, number>
  }
}

function isNode(value: unknown): value is OmniNode {
  return (
    isJsonObject(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    isNodeType(value.type) &&
    typeof value.name === 'string' &&
    typeof value.filePath === 'string' &&
    typeof value.line === 'number' &&
    typeof value.column === 'number' &&
    isJsonObject(value.metadata)
  )
}

function isEdge(value: unknown): value is OmniEdge {
  return (
    isJsonObject(value) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.target === 'string' &&
    typeof value.type === 'string' &&
    isEdgeType(value.type) &&
    (value.confidence === 'certain' || value.confidence === 'inferred') &&
    isJsonObject(value.metadata)
  )
}

function nodeArray(value: unknown): OmniNode[] | null {
  if (!Array.isArray(value)) return null
  const nodes: OmniNode[] = []
  for (const item of value) {
    if (!isNode(item)) return null
    nodes.push(item)
  }
  return nodes
}

function edgeArray(value: unknown): OmniEdge[] | null {
  if (!Array.isArray(value)) return null
  const edges: OmniEdge[] = []
  for (const item of value) {
    if (!isEdge(item)) return null
    edges.push(item)
  }
  return edges
}

export async function getTests(): Promise<TestsResponse> {
  const data = unwrap(await requestJson('/api/tests'))
  if (!isJsonObject(data) || !isJsonObject(data.summary)) {
    throw new Error('Invalid tests response')
  }
  const suites = nodeArray(data.suites)
  const cases = nodeArray(data.cases)
  const fixtures = nodeArray(data.fixtures)
  const coverage = edgeArray(data.coverage)
  if (!suites || !cases || !fixtures || !coverage) throw new Error('Invalid tests response')
  return {
    suites,
    cases,
    fixtures,
    coverage,
    summary: {
      suites: typeof data.summary.suites === 'number' ? data.summary.suites : 0,
      cases: typeof data.summary.cases === 'number' ? data.summary.cases : 0,
      fixtures: typeof data.summary.fixtures === 'number' ? data.summary.fixtures : 0,
      coveredTargets:
        typeof data.summary.coveredTargets === 'number' ? data.summary.coveredTargets : 0,
      uncoveredTargets:
        typeof data.summary.uncoveredTargets === 'number' ? data.summary.uncoveredTargets : 0,
      byFramework: isJsonObject(data.summary.byFramework)
        ? Object.fromEntries(
            Object.entries(data.summary.byFramework).filter(
              (entry): entry is [string, number] => typeof entry[1] === 'number',
            ),
          )
        : {},
    },
  }
}
