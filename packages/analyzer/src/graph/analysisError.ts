export type AnalysisErrorCode = 'NO_SUPPORTED_FILES' | 'NO_GRAPH_NODES'

export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AnalysisError'
  }
}
