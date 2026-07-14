import * as fs from 'node:fs'
import * as path from 'node:path'
import { ts } from 'ts-morph'
import {
  createEdgeId,
  type OmniNode,
  type ParseResult,
  type TestFramework,
} from '@codeomnivis/shared'
import type { TestAdapter } from '../types'
import { qualifiedTestName, testNodeId } from './astHelpers'

const CASE_NAMES = new Set(['it', 'test', 'xit', 'xtest'])
const HOOKS: Partial<Record<string, 'before_all' | 'before_each' | 'after_each' | 'after_all'>> = {
  beforeAll: 'before_all',
  beforeEach: 'before_each',
  afterEach: 'after_each',
  afterAll: 'after_all',
}

function framework(source: string): TestFramework | null {
  if (/from\s+['"]vitest['"]/u.test(source)) return 'vitest'
  if (/from\s+['"]@jest\/globals['"]/u.test(source) || /\bjest\b/u.test(source)) return 'jest'
  return null
}

function expressionPath(expression: ts.Expression): string[] {
  if (ts.isIdentifier(expression)) return [expression.text]
  if (ts.isPropertyAccessExpression(expression)) {
    return [...expressionPath(expression.expression), expression.name.text]
  }
  if (ts.isCallExpression(expression)) return expressionPath(expression.expression)
  return []
}

function callPath(call: ts.CallExpression): string[] {
  return expressionPath(call.expression)
}

function literalTestName(call: ts.CallExpression): string | null {
  const argument = call.arguments[0]
  return argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : null
}

function suiteAncestors(call: ts.CallExpression): string[] {
  const names: string[] = []
  let ancestor: ts.Node | undefined = call.parent
  while (ancestor) {
    if (ts.isCallExpression(ancestor) && callPath(ancestor)[0] === 'describe') {
      const name = literalTestName(ancestor)
      if (name) names.push(name)
    }
    ancestor = ancestor.parent
  }
  return names.reverse()
}

function location(
  source: ts.SourceFile,
  call: ts.CallExpression,
): { line: number; column: number } {
  const point = source.getLineAndCharacterOfPosition(call.getStart(source))
  return { line: point.line + 1, column: point.character + 1 }
}

function callExpressions(source: ts.SourceFile): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return calls
}

function suiteNode(
  filePath: string,
  name: string,
  call: ts.CallExpression,
  source: ts.SourceFile,
  kind: 'file' | 'describe',
  selected: TestFramework,
): OmniNode {
  return {
    id: testNodeId('test_suite', filePath, name),
    type: 'test_suite',
    name,
    filePath,
    ...location(source, call),
    metadata: { framework: selected, kind },
  }
}

function discoverSource(
  filePath: string,
  source: ts.SourceFile,
  selected: TestFramework,
): ParseResult {
  const nodes: OmniNode[] = []
  const edges: ParseResult['edges'] = []
  const errors: ParseResult['errors'] = []
  const suites = new Map<string, OmniNode>()
  const fixtures: Array<{ node: OmniNode; scope: string }> = []
  const fileSuiteName = path.basename(filePath)
  const calls = callExpressions(source)
  const firstCall = calls[0]
  if (firstCall) {
    const fileSuite = suiteNode(filePath, fileSuiteName, firstCall, source, 'file', selected)
    suites.set('', fileSuite)
    nodes.push(fileSuite)
  }

  for (const call of calls) {
    const parts = callPath(call)
    const base = parts[0]
    const ownName = literalTestName(call)
    const ancestors = suiteAncestors(call)
    if (base === 'describe' && ownName) {
      const name = qualifiedTestName(ancestors, ownName)
      if (!suites.has(name)) {
        const node = suiteNode(filePath, name, call, source, 'describe', selected)
        suites.set(name, node)
        nodes.push(node)
      }
      continue
    }
    const hook = HOOKS[base]
    if (hook) {
      const scope = ancestors.join(' > ')
      const name = qualifiedTestName(ancestors, `${base}@${location(source, call).line}`)
      const node: OmniNode = {
        id: testNodeId('test_fixture', filePath, name),
        type: 'test_fixture',
        name,
        filePath,
        ...location(source, call),
        metadata: { framework: selected, lifecycle: hook },
      }
      nodes.push(node)
      fixtures.push({ node, scope })
      continue
    }
    if (!CASE_NAMES.has(base) || !ownName) continue
    const name = qualifiedTestName(ancestors, ownName)
    const node: OmniNode = {
      id: testNodeId('test_case', filePath, name),
      type: 'test_case',
      name,
      filePath,
      ...location(source, call),
      metadata: {
        framework: selected,
        isParameterized: parts.includes('each'),
        ...(parts.includes('each') ? { parameterSource: call.expression.getText(source) } : {}),
        disabled: base.startsWith('x') || parts.includes('skip'),
      },
    }
    nodes.push(node)
    const scope = ancestors.join(' > ')
    const owner = suites.get(scope) ?? suites.get('')
    if (owner)
      edges.push({
        id: createEdgeId(owner.id, 'tests', node.id),
        source: owner.id,
        target: node.id,
        type: 'tests',
        confidence: 'certain',
        metadata: { relation: 'contains_case' },
      })
    for (const fixture of fixtures) {
      if (fixture.scope && !scope.startsWith(fixture.scope)) continue
      edges.push({
        id: createEdgeId(node.id, 'uses_fixture', fixture.node.id),
        source: node.id,
        target: fixture.node.id,
        type: 'uses_fixture',
        confidence: 'certain',
        metadata: { usage: 'lexical_scope' },
      })
    }
  }
  return { nodes, edges, errors }
}

export const VitestJestAdapter: TestAdapter = {
  name: 'vitest-jest',
  canHandle(filePath, context) {
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filePath) && !filePath.includes('__tests__'))
      return false
    try {
      return (
        framework(fs.readFileSync(path.resolve(context.projectRoot, filePath), 'utf8')) !== null
      )
    } catch {
      return false
    }
  },
  async discover(filePath, context) {
    try {
      const absolutePath = path.resolve(context.projectRoot, filePath)
      const sourceText = fs.readFileSync(absolutePath, 'utf8')
      const selected = framework(sourceText)
      if (!selected) return { nodes: [], edges: [], errors: [] }
      return discoverSource(
        filePath.replaceAll('\\', '/'),
        ts.createSourceFile(
          absolutePath,
          sourceText,
          ts.ScriptTarget.Latest,
          true,
          absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        ),
        selected,
      )
    } catch (error) {
      return {
        nodes: [],
        edges: [],
        errors: [
          {
            file: filePath,
            message: `Vitest/Jest discovery failed: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'warning',
          },
        ],
      }
    }
  },
}
