import type { OmniEdge, OmniGraph, OmniNode, TestFramework } from '@codeomnivis/shared'

export interface TestViewFilters {
  framework?: TestFramework
  target?: string
}

export interface TestViewSummary {
  suites: number
  cases: number
  fixtures: number
  coveredTargets: number
  uncoveredTargets: number
  byFramework: Record<TestFramework, number>
}

export interface TestView {
  suites: OmniNode[]
  cases: OmniNode[]
  fixtures: OmniNode[]
  coverage: OmniEdge[]
  summary: TestViewSummary
}

function isTestNode(
  node: OmniNode,
): node is Extract<OmniNode, { type: 'test_suite' | 'test_case' | 'test_fixture' }> {
  return node.type === 'test_suite' || node.type === 'test_case' || node.type === 'test_fixture'
}

export function projectTestView(graph: OmniGraph, filters: TestViewFilters = {}): TestView {
  const testNodes = graph.nodes
    .filter(isTestNode)
    .filter((node) => !filters.framework || node.metadata.framework === filters.framework)
  const testIds = new Set(testNodes.map((node) => node.id))
  const targetMatches = (node: OmniNode): boolean =>
    !filters.target ||
    node.id.includes(filters.target) ||
    node.name.toLowerCase().includes(filters.target.toLowerCase()) ||
    node.filePath.includes(filters.target)
  const targetIds = new Set(graph.nodes.filter(targetMatches).map((node) => node.id))
  const coverage = graph.edges.filter(
    (edge) =>
      edge.type === 'covers' &&
      testIds.has(edge.source) &&
      (!filters.target || targetIds.has(edge.target)),
  )
  const visibleCaseIds = filters.target ? new Set(coverage.map((edge) => edge.source)) : null
  const cases = testNodes.filter(
    (node) => node.type === 'test_case' && (!visibleCaseIds || visibleCaseIds.has(node.id)),
  )
  const suites = testNodes.filter((node) => node.type === 'test_suite')
  const fixtures = testNodes.filter((node) => node.type === 'test_fixture')
  const coveredTargetIds = new Set(coverage.map((edge) => edge.target))
  const productionTargets = graph.nodes.filter(
    (node) =>
      node.type !== 'test_suite' &&
      node.type !== 'test_case' &&
      node.type !== 'test_fixture' &&
      targetMatches(node),
  )
  const byFramework: Record<TestFramework, number> = {
    vitest: 0,
    jest: 0,
    playwright: 0,
    cypress: 0,
    junit4: 0,
    junit5: 0,
    kotest: 0,
  }
  for (const node of cases) byFramework[node.metadata.framework] += 1
  return {
    suites,
    cases,
    fixtures,
    coverage,
    summary: {
      suites: suites.length,
      cases: cases.length,
      fixtures: fixtures.length,
      coveredTargets: coveredTargetIds.size,
      uncoveredTargets: productionTargets.filter((node) => !coveredTargetIds.has(node.id)).length,
      byFramework,
    },
  }
}
