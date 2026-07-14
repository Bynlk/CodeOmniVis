import type { CodeOmniVisConfig, ProjectMeta } from '@codeomnivis/shared'
import { collectConfiguredScanDirs, detectProject } from '@codeomnivis/analyzer'

export async function autoDetectProject(
  root: string,
  config?: CodeOmniVisConfig,
): Promise<ProjectMeta> {
  return detectProject(root, config)
}

export const collectScanDirs = collectConfiguredScanDirs
