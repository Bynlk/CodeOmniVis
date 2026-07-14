import { Node, type CallExpression, type Expression } from 'ts-morph'

function expressionPath(expression: Expression): string[] {
  if (Node.isIdentifier(expression)) return [expression.getText()]
  if (Node.isPropertyAccessExpression(expression)) {
    return [...expressionPath(expression.getExpression()), expression.getName()]
  }
  if (Node.isCallExpression(expression)) return expressionPath(expression.getExpression())
  return []
}

export function callPath(call: CallExpression): string[] {
  return expressionPath(call.getExpression())
}

export function literalTestName(call: CallExpression): string | null {
  const argument = call.getArguments()[0]
  if (!argument) return null
  if (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) {
    return argument.getLiteralText()
  }
  return null
}

export function qualifiedTestName(ancestors: readonly string[], own: string): string {
  return [...ancestors, own].join(' > ')
}

export function testNodeId(
  type: 'test_suite' | 'test_case' | 'test_fixture',
  filePath: string,
  qualifiedName: string,
): string {
  return `${type}:${filePath}:${qualifiedName}`
}
