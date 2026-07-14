import * as fs from 'node:fs'
import * as path from 'node:path'
import { Node, Project, SyntaxKind, type CallExpression } from 'ts-morph'
import { createEdgeId, type OmniNode, type ParseResult } from '@codeomnivis/shared'
import type { TestAdapter } from '../types'
import { callPath, literalTestName, qualifiedTestName, testNodeId } from './astHelpers'

function ancestors(call: CallExpression): string[] {
  const names: string[] = []
  for (const ancestor of [...call.getAncestors()].reverse()) {
    if (!Node.isCallExpression(ancestor) || callPath(ancestor).join('.') !== 'test.describe') continue
    const name = literalTestName(ancestor)
    if (name) names.push(name)
  }
  return names
}

function callbackFixtureNames(call: CallExpression): string[] {
  const callback = call.getArguments().find(argument => Node.isArrowFunction(argument) || Node.isFunctionExpression(argument))
  if (!callback || (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback))) return []
  const binding = callback.getParameters()[0]?.getNameNode()
  if (!binding || !Node.isObjectBindingPattern(binding)) return []
  return binding.getElements().map(element => element.getName())
}

export const PlaywrightAdapter: TestAdapter = {
  name: 'playwright',
  canHandle(filePath, context) {
    try {
      return /@playwright\/test/u.test(fs.readFileSync(path.resolve(context.projectRoot, filePath), 'utf8'))
    } catch {
      return false
    }
  },
  async discover(filePath, context) {
    try {
      const absolute = path.resolve(context.projectRoot, filePath)
      const sourceText = fs.readFileSync(absolute, 'utf8')
      if (!/@playwright\/test/u.test(sourceText)) return { nodes: [], edges: [], errors: [] }
      const source = new Project({ skipAddingFilesFromTsConfig: true }).addSourceFileAtPath(absolute)
      const nodes: OmniNode[] = []
      const edges: ParseResult['edges'] = []
      const suites = new Map<string, OmniNode>()
      const fixtures = new Map<string, OmniNode>()
      for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const parts = callPath(call)
        const name = literalTestName(call)
        const scope = ancestors(call)
        const point = source.getLineAndColumnAtPos(call.getStart())
        if (parts.join('.') === 'test.describe' && name) {
          const qualified = qualifiedTestName(scope, name)
          const node: OmniNode = { id: testNodeId('test_suite', filePath, qualified), type: 'test_suite', name: qualified, filePath, ...point, metadata: { framework: 'playwright', kind: 'describe' } }
          suites.set(qualified, node)
          nodes.push(node)
          continue
        }
        if (parts.includes('extend')) {
          const object = call.getArguments()[0]
          if (object && Node.isObjectLiteralExpression(object)) {
            for (const property of object.getProperties()) {
              if (!Node.isPropertyAssignment(property) && !Node.isMethodDeclaration(property)) continue
              const fixtureName = property.getName()
              const node: OmniNode = { id: testNodeId('test_fixture', filePath, fixtureName), type: 'test_fixture', name: fixtureName, filePath, ...source.getLineAndColumnAtPos(property.getStart()), metadata: { framework: 'playwright', lifecycle: 'factory' } }
              fixtures.set(fixtureName, node)
              nodes.push(node)
            }
          }
          continue
        }
        if (parts[0] !== 'test' || parts.includes('describe') || parts.some(part => part.startsWith('before') || part.startsWith('after')) || !name) continue
        const qualified = qualifiedTestName(scope, name)
        const node: OmniNode = { id: testNodeId('test_case', filePath, qualified), type: 'test_case', name: qualified, filePath, ...point, metadata: { framework: 'playwright', isParameterized: false, disabled: parts.includes('skip') } }
        nodes.push(node)
        const owner = suites.get(scope.join(' > '))
        if (owner) edges.push({ id: createEdgeId(owner.id, 'tests', node.id), source: owner.id, target: node.id, type: 'tests', confidence: 'certain', metadata: { relation: 'contains_case' } })
        for (const fixtureName of callbackFixtureNames(call)) {
          const fixture = fixtures.get(fixtureName)
          if (fixture) edges.push({ id: createEdgeId(node.id, 'uses_fixture', fixture.id), source: node.id, target: fixture.id, type: 'uses_fixture', confidence: 'certain', metadata: { usage: 'parameter' } })
        }
      }
      return { nodes, edges, errors: [] }
    } catch (error) {
      return { nodes: [], edges: [], errors: [{ file: filePath, message: `Playwright discovery failed: ${error instanceof Error ? error.message : String(error)}`, severity: 'warning' }] }
    }
  },
}
