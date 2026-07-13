export type WorkbenchView = 'architecture' | 'requests' | 'data' | 'quality'

export type ArchitectureDepth = 'overview' | 'full' | 'focus'

export interface WorkbenchGraphOptions {
  view: WorkbenchView
  depth: ArchitectureDepth
  focusNodeId?: string | null
  searchQuery?: string
}
