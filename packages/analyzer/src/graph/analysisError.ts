export type AnalysisErrorCode = 'NO_SUPPORTED_FILES' | 'NO_GRAPH_NODES' | 'STORAGE_FAILURE'

export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AnalysisError'
  }
}
