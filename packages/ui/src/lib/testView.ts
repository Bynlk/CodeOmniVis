import type { OmniGraph, OmniNode } from '@codeomnivis/shared'

export interface TestSuiteGroup {
  suite: OmniNode
  cases: OmniNode[]
  fixtures: OmniNode[]
}

export function buildTestSuiteGroups(graph: OmniGraph): TestSuiteGroup[] {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]))
  return graph.nodes.filter(node => node.type === 'test_suite').map(suite => {
    const caseIds = new Set(graph.edges.filter(edge => edge.type === 'tests' && edge.source === suite.id).map(edge => edge.target))
    const cases = [...caseIds].map(id => nodes.get(id)).filter((node): node is OmniNode => node?.type === 'test_case')
    const fixtureFiles = new Set(cases.map(testCase => testCase.filePath))
    const fixtures = graph.nodes.filter(node => node.type === 'test_fixture' && (node.filePath === suite.filePath || fixtureFiles.has(node.filePath)))
    return { suite, cases, fixtures }
  })
}

export function selectTestGraph(graph: OmniGraph, selectedCaseId?: string | null): OmniGraph {
  const testIds = new Set(graph.nodes.filter(node => node.type === 'test_suite' || node.type === 'test_case' || node.type === 'test_fixture').map(node => node.id))
  const edges = graph.edges.filter(edge =>
    (edge.type === 'tests' || edge.type === 'uses_fixture') && testIds.has(edge.source) && testIds.has(edge.target)
    || edge.type === 'covers' && (!selectedCaseId || edge.source === selectedCaseId),
  )
  const nodeIds = new Set([...testIds, ...edges.flatMap(edge => [edge.source, edge.target])])
  return { nodes: graph.nodes.filter(node => nodeIds.has(node.id)), edges }
}
