import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  Node,
  Project,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph'
import { createEdgeId, type OmniNode, type ParseResult, type TestFramework } from '@codeomnivis/shared'
import type { TestAdapter } from '../types'
import { callPath, literalTestName, qualifiedTestName, testNodeId } from './astHelpers'

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

function suiteAncestors(call: CallExpression): string[] {
  const names: string[] = []
  for (const ancestor of [...call.getAncestors()].reverse()) {
    if (!Node.isCallExpression(ancestor)) continue
    if (callPath(ancestor)[0] !== 'describe') continue
    const name = literalTestName(ancestor)
    if (name) names.push(name)
  }
  return names
}

function location(source: SourceFile, call: CallExpression): { line: number; column: number } {
  return source.getLineAndColumnAtPos(call.getStart())
}

function suiteNode(filePath: string, name: string, call: CallExpression, source: SourceFile, kind: 'file' | 'describe', selected: TestFramework): OmniNode {
  return {
    id: testNodeId('test_suite', filePath, name), type: 'test_suite', name, filePath,
    ...location(source, call), metadata: { framework: selected, kind },
  }
}

function discoverSource(filePath: string, source: SourceFile, selected: TestFramework): ParseResult {
  const nodes: OmniNode[] = []
  const edges: ParseResult['edges'] = []
  const errors: ParseResult['errors'] = []
  const suites = new Map<string, OmniNode>()
  const fixtures: Array<{ node: OmniNode; scope: string }> = []
  const fileSuiteName = path.basename(filePath)
  const firstCall = source.getFirstDescendantByKind(SyntaxKind.CallExpression)
  if (firstCall) {
    const fileSuite = suiteNode(filePath, fileSuiteName, firstCall, source, 'file', selected)
    suites.set('', fileSuite)
    nodes.push(fileSuite)
  }

  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
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
      const name = qualifiedTestName(ancestors, `${base}@${call.getStartLineNumber()}`)
      const node: OmniNode = {
        id: testNodeId('test_fixture', filePath, name), type: 'test_fixture', name, filePath,
        ...location(source, call), metadata: { framework: selected, lifecycle: hook },
      }
      nodes.push(node)
      fixtures.push({ node, scope })
      continue
    }
    if (!CASE_NAMES.has(base) || !ownName) continue
    const name = qualifiedTestName(ancestors, ownName)
    const node: OmniNode = {
      id: testNodeId('test_case', filePath, name), type: 'test_case', name, filePath,
      ...location(source, call),
      metadata: {
        framework: selected,
        isParameterized: parts.includes('each'),
        ...(parts.includes('each') ? { parameterSource: call.getExpression().getText() } : {}),
        disabled: base.startsWith('x') || parts.includes('skip'),
      },
    }
    nodes.push(node)
    const scope = ancestors.join(' > ')
    const owner = suites.get(scope) ?? suites.get('')
    if (owner) edges.push({
      id: createEdgeId(owner.id, 'tests', node.id), source: owner.id, target: node.id,
      type: 'tests', confidence: 'certain', metadata: { relation: 'contains_case' },
    })
    for (const fixture of fixtures) {
      if (fixture.scope && !scope.startsWith(fixture.scope)) continue
      edges.push({
        id: createEdgeId(node.id, 'uses_fixture', fixture.node.id), source: node.id, target: fixture.node.id,
        type: 'uses_fixture', confidence: 'certain', metadata: { usage: 'lexical_scope' },
      })
    }
  }
  if (source.getPreEmitDiagnostics().some(diagnostic => diagnostic.getCategory() === 1)) {
    errors.push({ file: filePath, message: 'Test file contains TypeScript syntax errors', severity: 'warning' })
  }
  return { nodes, edges, errors }
}

export const VitestJestAdapter: TestAdapter = {
  name: 'vitest-jest',
  canHandle(filePath, context) {
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filePath) && !filePath.includes('__tests__')) return false
    try {
      return framework(fs.readFileSync(path.resolve(context.projectRoot, filePath), 'utf8')) !== null
    } catch {
      return false
    }
  },
  async discover(filePath, context) {
    try {
      const absolutePath = path.resolve(context.projectRoot, filePath)
      const selected = framework(fs.readFileSync(absolutePath, 'utf8'))
      if (!selected) return { nodes: [], edges: [], errors: [] }
      const project = new Project({ skipAddingFilesFromTsConfig: true })
      return discoverSource(filePath.replaceAll('\\', '/'), project.addSourceFileAtPath(absolutePath), selected)
    } catch (error) {
      return {
        nodes: [], edges: [],
        errors: [{ file: filePath, message: `Vitest/Jest discovery failed: ${error instanceof Error ? error.message : String(error)}`, severity: 'warning' }],
      }
    }
  },
}
