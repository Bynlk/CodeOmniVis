import { createEdgeId, type OmniNode, type ParseResult } from '@codeomnivis/shared'
import type { TestAdapter } from '../types'
import { testNodeId } from '../typescript/astHelpers'
import { loadKotlinTestSource } from './kotlinTestHelpers'

export const KotestAdapter: TestAdapter = {
  name: 'kotest',
  canHandle(filePath) {
    return filePath.endsWith('.kt')
  },
  async discover(filePath, context) {
    let loaded: Awaited<ReturnType<typeof loadKotlinTestSource>> | null = null
    try {
      loaded = await loadKotlinTestSource(context.projectRoot, filePath)
      if (!loaded.source.includes('io.kotest')) return { nodes: [], edges: [], errors: [] }
      const classMatch = /class\s+(\w+)\s*:\s*(FunSpec|StringSpec|BehaviorSpec|DescribeSpec)/u.exec(
        loaded.source,
      )
      if (!classMatch) return { nodes: [], edges: [], errors: [] }
      const suite: OmniNode = {
        id: testNodeId('test_suite', filePath, classMatch[1]),
        type: 'test_suite',
        name: classMatch[1],
        filePath,
        ...loaded.position(classMatch.index),
        metadata: { framework: 'kotest', kind: 'spec' },
      }
      const nodes: OmniNode[] = [suite]
      const edges: ParseResult['edges'] = []
      for (const hook of loaded.source.matchAll(
        /\b(beforeEach|beforeSpec|afterEach|afterSpec)\s*\{/gu,
      )) {
        const lifecycle =
          hook[1] === 'beforeEach'
            ? 'before_each'
            : hook[1] === 'beforeSpec'
              ? 'before_all'
              : hook[1] === 'afterEach'
                ? 'after_each'
                : 'after_all'
        const name = `${hook[1]}@${loaded.position(hook.index).line}`
        nodes.push({
          id: testNodeId('test_fixture', filePath, name),
          type: 'test_fixture',
          name,
          filePath,
          ...loaded.position(hook.index),
          metadata: { framework: 'kotest', lifecycle },
        })
      }
      for (const test of loaded.source.matchAll(/\btest\("([^"]+)"\)/gu)) {
        const name = `${suite.name} > ${test[1]}`
        const node: OmniNode = {
          id: testNodeId('test_case', filePath, name),
          type: 'test_case',
          name,
          filePath,
          ...loaded.position(test.index),
          metadata: { framework: 'kotest', isParameterized: false, disabled: false },
        }
        nodes.push(node)
        edges.push({
          id: createEdgeId(suite.id, 'tests', node.id),
          source: suite.id,
          target: node.id,
          type: 'tests',
          confidence: 'certain',
          metadata: { relation: 'contains_case' },
        })
      }
      return { nodes, edges, errors: [] }
    } catch (error) {
      return {
        nodes: [],
        edges: [],
        errors: [
          {
            file: filePath,
            message: `Kotest discovery failed: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'warning',
          },
        ],
      }
    } finally {
      loaded?.close()
    }
  },
}
