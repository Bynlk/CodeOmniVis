import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import type { CodeOmniVisConfig, ProjectMeta } from '@codeomnivis/shared'
import { stableDigest } from '@codeomnivis/shared/node'

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}

function fileDigest(filePath: string): string | null {
  try {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  } catch {
    return null
  }
}

export function computeProjectFingerprint(
  projectRoot: string,
  meta: ProjectMeta,
  config?: CodeOmniVisConfig,
): string {
  const locks = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb']
    .map(file => ({ file, digest: fileDigest(path.join(projectRoot, file)) }))
    .filter(item => item.digest !== null)
  return stableDigest({
    root: normalizePath(fs.realpathSync.native(projectRoot)),
    frameworks: {
      frontend: meta.frontendFramework,
      backend: meta.backendFramework,
      database: meta.databaseType,
      monorepo: meta.monorepoType,
    },
    config: config ?? null,
    locks,
  })
}

export function computeSourceDigest(projectRoot: string, files: readonly string[]): string {
  return stableDigest(files.map(file => {
    const normalized = normalizePath(file)
    return {
      path: normalized,
      digest: fileDigest(path.resolve(projectRoot, file)) ?? 'missing',
    }
  }).sort((left, right) => left.path.localeCompare(right.path)))
}
