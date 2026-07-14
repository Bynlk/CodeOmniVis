import * as fs from 'node:fs'
import * as path from 'node:path'
import { Node, Project, SyntaxKind, type CallExpression } from 'ts-morph'
import { createEdgeId, type OmniNode, type ParseResult } from '@codeomnivis/shared'
import type { TestAdapter } from '../types'
import { callPath, literalTestName, qualifiedTestName, testNodeId } from './astHelpers'

function suiteNames(call: CallExpression): string[] {
  const names: string[] = []
  for (const ancestor of [...call.getAncestors()].reverse()) {
    if (
      !Node.isCallExpression(ancestor) ||
      !['describe', 'context'].includes(callPath(ancestor)[0])
    )
      continue
    const name = literalTestName(ancestor)
    if (name) names.push(name)
  }
  return names
}

export const CypressAdapter: TestAdapter = {
  name: 'cypress',
  canHandle(filePath, context) {
    try {
      const source = fs.readFileSync(path.resolve(context.projectRoot, filePath), 'utf8')
      return (
        filePath.includes('cypress/e2e') ||
        /\bcy\.(?:visit|request)\b/u.test(source) ||
        /from\s+['"]cypress['"]/u.test(source)
      )
    } catch {
      return false
    }
  },
  async discover(filePath, context) {
    try {
      const absolute = path.resolve(context.projectRoot, filePath)
      const sourceText = fs.readFileSync(absolute, 'utf8')
      if (!/\bcy\.|from\s+['"]cypress['"]/u.test(sourceText) && !filePath.includes('cypress/e2e'))
        return { nodes: [], edges: [], errors: [] }
      const source = new Project({ skipAddingFilesFromTsConfig: true }).addSourceFileAtPath(
        absolute,
      )
      const nodes: OmniNode[] = []
      const edges: ParseResult['edges'] = []
      const suites = new Map<string, OmniNode>()
      for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const base = callPath(call)[0]
        const own = literalTestName(call)
        const scope = suiteNames(call)
        const point = source.getLineAndColumnAtPos(call.getStart())
        if (['describe', 'context'].includes(base) && own) {
          const name = qualifiedTestName(scope, own)
          const node: OmniNode = {
            id: testNodeId('test_suite', filePath, name),
            type: 'test_suite',
            name,
            filePath,
            ...point,
            metadata: { framework: 'cypress', kind: 'describe' },
          }
          suites.set(name, node)
          nodes.push(node)
        } else if (['before', 'beforeEach', 'afterEach', 'after'].includes(base)) {
          const lifecycle =
            base === 'before'
              ? 'before_all'
              : base === 'after'
                ? 'after_all'
                : base === 'beforeEach'
                  ? 'before_each'
                  : 'after_each'
          const name = qualifiedTestName(scope, `${base}@${point.line}`)
          nodes.push({
            id: testNodeId('test_fixture', filePath, name),
            type: 'test_fixture',
            name,
            filePath,
            ...point,
            metadata: { framework: 'cypress', lifecycle },
          })
        } else if (['it', 'test'].includes(base) && own) {
          const name = qualifiedTestName(scope, own)
          const node: OmniNode = {
            id: testNodeId('test_case', filePath, name),
            type: 'test_case',
            name,
            filePath,
            ...point,
            metadata: {
              framework: 'cypress',
              isParameterized: false,
              disabled: callPath(call).includes('skip'),
            },
          }
          nodes.push(node)
          const owner = suites.get(scope.join(' > '))
          if (owner)
            edges.push({
              id: createEdgeId(owner.id, 'tests', node.id),
              source: owner.id,
              target: node.id,
              type: 'tests',
              confidence: 'certain',
              metadata: { relation: 'contains_case' },
            })
        }
      }
      return { nodes, edges, errors: [] }
    } catch (error) {
      return {
        nodes: [],
        edges: [],
        errors: [
          {
            file: filePath,
            message: `Cypress discovery failed: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'warning',
          },
        ],
      }
    }
  },
}
