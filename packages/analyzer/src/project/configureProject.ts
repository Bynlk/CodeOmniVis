import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CodeOmniVisConfig, ProjectMeta } from '@codeomnivis/shared'

function safeConfiguredPath(root: string, candidate: string): string | null {
  const resolved = path.resolve(root, candidate)
  try {
    const real = fs.realpathSync.native(resolved)
    const lexicalRelative = path.relative(root, resolved)
    const realRelative = path.relative(root, real)
    const lexicalInside = lexicalRelative === ''
      || (!lexicalRelative.startsWith('..') && !path.isAbsolute(lexicalRelative))
    const realInside = realRelative === ''
      || (!realRelative.startsWith('..') && !path.isAbsolute(realRelative))
    if (lexicalInside && !realInside) return null
    return real
  } catch {
    return resolved
  }
}

function configuredPaths(root: string, values: string[]): string[] {
  return values
    .map(value => safeConfiguredPath(root, value))
    .filter((value): value is string => value !== null)
}

export function applyProjectConfig(
  meta: ProjectMeta,
  config: CodeOmniVisConfig | undefined,
): ProjectMeta {
  if (!config) return meta
  const frontend = config.frontend?.framework
  if (frontend === 'next') meta.frontendFramework = frontend
  const backend = config.backend?.framework
  if (backend === 'express' || backend === 'trpc' || backend === 'tsrpc') {
    meta.backendFramework = backend
  }
  if (config.frontend?.dirs?.length) {
    meta.frontendDirs = configuredPaths(meta.root, config.frontend.dirs)
  }
  if (config.backend?.dirs?.length) {
    meta.backendDirs = configuredPaths(meta.root, config.backend.dirs)
  }
  if (config.database?.prismaSchema) {
    meta.prismaSchemaPath = safeConfiguredPath(meta.root, config.database.prismaSchema)
  }
  if (config.database?.typeormDirs?.length) {
    meta.typeormEntityDirs = configuredPaths(meta.root, config.database.typeormDirs)
  }
  return meta
}
