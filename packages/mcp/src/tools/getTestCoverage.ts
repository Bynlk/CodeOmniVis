import { projectTestView, type OmniDatabase } from '@codeomnivis/analyzer'
import { isJsonObject, isTestFramework } from '@codeomnivis/shared'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export function handleGetTestCoverage(db: OmniDatabase, args: unknown): CallToolResult {
  const frameworkValue = isJsonObject(args) ? args.framework : undefined
  const framework = typeof frameworkValue === 'string' && isTestFramework(frameworkValue)
    ? frameworkValue
    : undefined
  const targetValue = isJsonObject(args) ? args.target : undefined
  const target = typeof targetValue === 'string' ? targetValue : undefined
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(projectTestView(db.loadGraph(), { framework, target }), null, 2),
    }],
  }
}
