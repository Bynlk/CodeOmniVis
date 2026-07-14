import type { OmniNode, ParseResult, ProjectMeta } from '@codeomnivis/shared'

export interface TestDiscoveryContext {
  projectRoot: string
  projectMeta: ProjectMeta
  tsConfig: import('typescript').ParsedCommandLine | null
  pathAliases: Record<string, string>
  knownProductionNodes: ReadonlyArray<OmniNode>
}

export interface TestAdapter {
  name: string
  canHandle(filePath: string, context: TestDiscoveryContext): boolean
  discover(filePath: string, context: TestDiscoveryContext): Promise<ParseResult>
}
