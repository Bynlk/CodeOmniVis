import {
  isNodeOfType,
  type OmniGraph,
  type OmniNode,
  type TestFramework,
} from '@codeomnivis/shared'

export interface TestSuiteGroup {
  suite: OmniNode
  cases: OmniNode[]
  fixtures: OmniNode[]
}

export interface TestSuiteFilters {
  framework: TestFramework | 'all'
  status: 'all' | 'enabled' | 'disabled'
}

export function buildTestSuiteGroups(graph: OmniGraph): TestSuiteGroup[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  return graph.nodes
    .filter((node) => node.type === 'test_suite')
    .map((suite) => {
      const caseIds = new Set(
        graph.edges
          .filter((edge) => edge.type === 'tests' && edge.source === suite.id)
          .map((edge) => edge.target),
      )
      const cases = [...caseIds]
        .map((id) => nodes.get(id))
        .filter((node): node is OmniNode => node?.type === 'test_case')
      const fixtureFiles = new Set(cases.map((testCase) => testCase.filePath))
      const fixtures = graph.nodes.filter(
        (node) =>
          node.type === 'test_fixture' &&
          (node.filePath === suite.filePath || fixtureFiles.has(node.filePath)),
      )
      return { suite, cases, fixtures }
    })
}

export function filterTestSuiteGroups(
  groups: readonly TestSuiteGroup[],
  filters: TestSuiteFilters,
): TestSuiteGroup[] {
  return groups.flatMap((group) => {
    if (!isNodeOfType(group.suite, 'test_suite')) return []
    if (filters.framework !== 'all' && group.suite.metadata.framework !== filters.framework)
      return []
    const cases = group.cases.filter((testCase) => {
      if (!isNodeOfType(testCase, 'test_case')) return false
      if (filters.framework !== 'all' && testCase.metadata.framework !== filters.framework)
        return false
      if (filters.status === 'enabled') return !testCase.metadata.disabled
      if (filters.status === 'disabled') return testCase.metadata.disabled
      return true
    })
    if (filters.status !== 'all' && cases.length === 0) return []
    return [{ ...group, cases }]
  })
}

export function selectTestGraph(graph: OmniGraph, selectedCaseId?: string | null): OmniGraph {
  const testIds = new Set(
    graph.nodes
      .filter(
        (node) =>
          node.type === 'test_suite' || node.type === 'test_case' || node.type === 'test_fixture',
      )
      .map((node) => node.id),
  )
  const edges = graph.edges.filter(
    (edge) =>
      ((edge.type === 'tests' || edge.type === 'uses_fixture') &&
        testIds.has(edge.source) &&
        testIds.has(edge.target)) ||
      (edge.type === 'covers' && (!selectedCaseId || edge.source === selectedCaseId)),
  )
  const nodeIds = new Set([...testIds, ...edges.flatMap((edge) => [edge.source, edge.target])])
  return { nodes: graph.nodes.filter((node) => nodeIds.has(node.id)), edges }
}
