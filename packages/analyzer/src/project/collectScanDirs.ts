import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CodeOmniVisConfig } from '@codeomnivis/shared'
import { discoverWorkspacePackages } from './workspacePackages'

function isDirectory(directory: string): boolean {
  try {
    return fs.statSync(directory).isDirectory()
  } catch {
    return false
  }
}

function safeAutomaticDirectory(root: string, directory: string): string | null {
  if (!isDirectory(directory)) return null
  try {
    const realRoot = fs.realpathSync.native(root)
    const realDirectory = fs.realpathSync.native(directory)
    const relative = path.relative(realRoot, realDirectory)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
      ? path.resolve(directory)
      : null
  } catch {
    return null
  }
}

export function collectConfiguredScanDirs(root: string, config?: CodeOmniVisConfig): string[] {
  const resolvedRoot = path.resolve(root)
  const explicit = [...(config?.frontend?.dirs ?? []), ...(config?.backend?.dirs ?? [])]
    .map((directory) => path.resolve(resolvedRoot, directory))
    .filter(isDirectory)
  if (explicit.length > 0) return [...new Set(explicit)]

  const candidates = [
    'apps/web/src',
    'apps/web',
    'src',
    'app',
    'pages',
    'components',
    'hooks',
    'lib',
    'features',
    'services',
    'server',
    'api',
    'src/components',
    'src/hooks',
    'src/lib',
    'src/features',
    'src/services',
    'frontend/src',
    'backend/src',
    ...discoverWorkspacePackages(resolvedRoot).map((pkg) => `${pkg.path}/src`),
  ]
  return [
    ...new Set(
      candidates
        .map((directory) =>
          safeAutomaticDirectory(resolvedRoot, path.resolve(resolvedRoot, directory)),
        )
        .filter((directory): directory is string => directory !== null),
    ),
  ]
}
