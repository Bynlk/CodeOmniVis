import { createHash } from 'node:crypto'
import type { ProjectMeta } from '../types/graph'
import type { ProjectSnapshot } from '../types/snapshot'

const OMIT = Symbol('omit')

function canonicalValue(value: unknown, seen: WeakSet<object>): unknown | typeof OMIT {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return OMIT
  }
  if (typeof value === 'bigint') throw new TypeError('BigInt is not JSON serializable')
  if (typeof value !== 'object') return OMIT
  if (seen.has(value)) throw new TypeError('Cannot canonicalize a circular structure')
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const normalized = canonicalValue(item, seen)
        return normalized === OMIT ? null : normalized
      })
    }
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const normalized = canonicalValue((value as Record<string, unknown>)[key], seen)
      if (normalized !== OMIT) result[key] = normalized
    }
    return result
  } finally {
    seen.delete(value)
  }
}

export function canonicalJson(value: unknown): string {
  const normalized = canonicalValue(value, new WeakSet())
  if (normalized === OMIT) throw new TypeError('Root value is not JSON serializable')
  return JSON.stringify(normalized)
}

export function stableDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/')
}

function normalizeRootedString(value: string, root: string): string {
  const normalized = normalizePath(value)
  if (normalized === root) return '<root>'
  return normalized.startsWith(`${root}/`) ? `<root>${normalized.slice(root.length)}` : normalized
}

function normalizeStrings(value: unknown, root: string): unknown {
  if (typeof value === 'string') return normalizeRootedString(value, root)
  if (Array.isArray(value)) return value.map((item) => normalizeStrings(item, root))
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeStrings(item, root)]),
  )
}

function sorted(values: readonly string[]): string[] {
  return values.map(normalizePath).sort()
}

function normalizeProjectMeta(meta: ProjectMeta, root: string): ProjectMeta {
  const normalized = normalizeStrings(meta, root) as ProjectMeta
  return {
    ...normalized,
    frontendDirs: sorted(normalized.frontendDirs),
    backendDirs: sorted(normalized.backendDirs),
    trpcRouterPaths: sorted(normalized.trpcRouterPaths),
    tsrpcServicePaths: sorted(normalized.tsrpcServicePaths),
    tsrpcApiDirs: sorted(normalized.tsrpcApiDirs),
    tsrpcProtocolDirs: sorted(normalized.tsrpcProtocolDirs),
    typeormEntityDirs: sorted(normalized.typeormEntityDirs),
    packages: normalized.packages
      .map((pkg) => ({
        ...pkg,
        path: normalizePath(pkg.path),
        dependencies: [...pkg.dependencies].sort(),
        devDependencies: [...pkg.devDependencies].sort(),
      }))
      .sort((left, right) =>
        `${left.path}\0${left.name}`.localeCompare(`${right.path}\0${right.name}`),
      ),
  }
}

function sortByCanonical<T>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)))
}

export function computeSnapshotDigest(snapshot: ProjectSnapshot): string {
  const root = normalizePath(snapshot.project.root).replace(/\/+$/u, '')
  const nodes = snapshot.graph.nodes
    .map((node) => normalizeStrings(node, root) as typeof node)
    .sort((left, right) => left.id.localeCompare(right.id))
  const edges = snapshot.graph.edges
    .map((edge) => normalizeStrings(edge, root) as typeof edge)
    .sort((left, right) => left.id.localeCompare(right.id))
  const issues = snapshot.issues
    .map((issue) => {
      const normalized = normalizeStrings(issue, root) as typeof issue
      return {
        ...normalized,
        locations: sortByCanonical(normalized.locations),
        relatedNodeIds: [...normalized.relatedNodeIds].sort(),
        relatedEdgeIds: [...normalized.relatedEdgeIds].sort(),
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
  const parseErrors = sortByCanonical(
    snapshot.parseErrors.map((error) => normalizeStrings(error, root) as typeof error),
  )

  return stableDigest({
    schemaVersion: snapshot.schemaVersion,
    project: {
      fingerprint: snapshot.project.fingerprint,
      meta: normalizeProjectMeta(snapshot.project.meta, root),
    },
    graph: { nodes, edges },
    issues,
    parseErrors,
    stats: snapshot.stats,
    freshness: {
      state: snapshot.freshness.state,
      pendingChanges: snapshot.freshness.pendingChanges,
    },
    provenance: {
      analyzerVersion: snapshot.provenance.analyzerVersion,
      filesScanned: snapshot.provenance.filesScanned,
      sourceDigest: snapshot.provenance.sourceDigest,
      testRuns: snapshot.provenance.testRuns?.map((run) => ({
        source: run.source,
        cases: sortByCanonical(run.cases),
        unmatched: sortByCanonical(run.unmatched),
      })),
    },
  })
}
