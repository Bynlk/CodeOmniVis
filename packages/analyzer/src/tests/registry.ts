import type { ParseResult } from '@codeomnivis/shared'
import type { TestAdapter, TestDiscoveryContext } from './types'

export async function discoverTests(
  filePath: string,
  context: TestDiscoveryContext,
  adapters: readonly TestAdapter[],
): Promise<ParseResult> {
  const nodes = new Map<string, ParseResult['nodes'][number]>()
  const edges = new Map<string, ParseResult['edges'][number]>()
  const errors: ParseResult['errors'] = []

  for (const adapter of adapters) {
    try {
      if (!adapter.canHandle(filePath, context)) continue
      const result = await adapter.discover(filePath, context)
      for (const node of result.nodes) if (!nodes.has(node.id)) nodes.set(node.id, node)
      for (const edge of result.edges) if (!edges.has(edge.id)) edges.set(edge.id, edge)
      errors.push(...result.errors)
    } catch (error) {
      errors.push({
        file: filePath,
        message: `Test adapter ${adapter.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'warning',
      })
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()], errors }
}
