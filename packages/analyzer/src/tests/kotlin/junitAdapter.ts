import { createEdgeId, type OmniNode, type ParseResult, type TestFramework } from '@codeomnivis/shared'
import type { TestAdapter } from '../types'
import { testNodeId } from '../typescript/astHelpers'
import { loadKotlinTestSource } from './kotlinTestHelpers'

function junitFramework(source: string): TestFramework | null {
  if (source.includes('org.junit.jupiter')) return 'junit5'
  if (source.includes('org.junit.')) return 'junit4'
  return null
}

export const JunitAdapter: TestAdapter = {
  name: 'junit',
  canHandle(filePath, context) {
    return filePath.endsWith('.kt') && (context.projectMeta.backendFramework !== 'unknown' || filePath.includes('/test/'))
  },
  async discover(filePath, context) {
    let loaded: Awaited<ReturnType<typeof loadKotlinTestSource>> | null = null
    try {
      loaded = await loadKotlinTestSource(context.projectRoot, filePath)
      const selected = junitFramework(loaded.source)
      if (!selected) return { nodes: [], edges: [], errors: [] }
      const nodes: OmniNode[] = []
      const edges: ParseResult['edges'] = []
      const suites: OmniNode[] = []
      for (const match of loaded.source.matchAll(/(?:@Nested\s+)?(?:inner\s+)?class\s+(\w+)/gu)) {
        const name = match[1]
        const node: OmniNode = {
          id: testNodeId('test_suite', filePath, name), type: 'test_suite', name, filePath,
          ...loaded.position(match.index), metadata: { framework: selected, kind: suites.length === 0 ? 'class' : 'nested_class' },
        }
        suites.push(node)
        nodes.push(node)
      }
      const owner = suites[0]
      const declaration = /((?:@\w+(?:\([^\n]*\))?\s*)+)fun\s+(\w+)\s*\(/gu
      for (const match of loaded.source.matchAll(declaration)) {
        const annotations = match[1]
        const functionName = match[2]
        const point = loaded.position(match.index)
        const lifecycle = annotations.includes('@BeforeEach') || annotations.includes('@Before')
          ? 'before_each'
          : annotations.includes('@AfterEach') || annotations.includes('@After')
            ? 'after_each'
            : annotations.includes('@BeforeAll') ? 'before_all' : annotations.includes('@AfterAll') ? 'after_all' : null
        if (lifecycle) {
          nodes.push({ id: testNodeId('test_fixture', filePath, functionName), type: 'test_fixture', name: functionName, filePath, ...point, metadata: { framework: selected, lifecycle } })
          continue
        }
        if (!annotations.includes('@Test') && !annotations.includes('@ParameterizedTest')) continue
        const source = annotations.match(/@(?:MethodSource|ValueSource)\("?([^")]+)"?\)/u)?.[1]
        const name = owner ? `${owner.name} > ${functionName}` : functionName
        const node: OmniNode = {
          id: testNodeId('test_case', filePath, name), type: 'test_case', name, filePath, ...point,
          metadata: { framework: selected, isParameterized: annotations.includes('@ParameterizedTest'), ...(source ? { parameterSource: source } : {}), disabled: annotations.includes('@Disabled') || annotations.includes('@Ignore') },
        }
        nodes.push(node)
        if (owner) edges.push({ id: createEdgeId(owner.id, 'tests', node.id), source: owner.id, target: node.id, type: 'tests', confidence: 'certain', metadata: { relation: 'contains_case' } })
      }
      return { nodes, edges, errors: [] }
    } catch (error) {
      return { nodes: [], edges: [], errors: [{ file: filePath, message: `JUnit discovery failed: ${error instanceof Error ? error.message : String(error)}`, severity: 'warning' }] }
    } finally {
      loaded?.close()
    }
  },
}
