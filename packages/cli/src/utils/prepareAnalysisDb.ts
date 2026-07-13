import type { OmniDatabase } from '@codeomnivis/analyzer'

/** A CLI `serve` start is a full snapshot, never an append to a prior cached project graph. */
export function prepareAnalysisDb(db: OmniDatabase): void {
  db.clearGraph()
}
