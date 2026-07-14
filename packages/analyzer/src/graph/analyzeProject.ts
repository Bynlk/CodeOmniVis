import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import type {
  CodeOmniVisConfig,
  ProjectSnapshot,
  ProjectMeta,
  SerializableParseError,
} from '@codeomnivis/shared'
import { computeSnapshotDigest } from '@codeomnivis/shared/node'
import { CrossLayerLinker } from '../resolver/crossLayer'
import { OmniDatabase, type DbError } from '../storage/db'
import { replaceLegacySnapshot, type AnalysisStore } from '../storage/legacySnapshotStore'
import { computeProjectFingerprint, computeSourceDigest } from '../project/fingerprint'
import {
  detectProject,
  resolveProjectRoot,
  type ProjectDetectionWarning,
} from '../project/detectProject'
import { AnalysisError } from './analysisError'
import { collectAnalysisFiles } from './collectAnalysisFiles'
import { createDefaultParsers } from './createDefaultParsers'
import { GraphBuilder } from './builder'
import { sanitizeGraph } from '@codeomnivis/shared'
import { detectAnalysisIssues } from './analysisIssues'
import { createAnalysisStats } from './analysisStats'

export type { AnalysisStore } from '../storage/legacySnapshotStore'

export type AnalysisProgressPhase =
  | 'detecting_project'
  | 'collecting_files'
  | 'parsing_files'
  | 'linking_graph'
  | 'validating_graph'
  | 'detecting_issues'
  | 'committing_snapshot'
  | 'analysis_complete'

export interface AnalysisProgressEvent {
  phase: AnalysisProgressPhase
  filesScanned?: number
}

export interface AnalyzeProjectOptions {
  projectRoot: string
  dbPath?: string
  db?: AnalysisStore
  config?: CodeOmniVisConfig
  /** Compatibility input; new callers should let detectProject own metadata discovery. */
  projectMeta?: ProjectMeta
  signal?: AbortSignal
  onProgress?: (event: AnalysisProgressEvent) => void
}

function rebasePath(value: string, fromRoot: string, toRoot: string): string {
  if (!path.isAbsolute(value)) return value
  const relative = path.relative(fromRoot, value)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    ? path.join(toRoot, relative)
    : value
}

function canonicalizeProvidedMeta(meta: ProjectMeta, projectRoot: string): ProjectMeta {
  const fromRoot = path.resolve(meta.root)
  const mapPaths = (values: string[]): string[] => values.map(value => rebasePath(value, fromRoot, projectRoot))
  return {
    ...meta,
    root: projectRoot,
    frontendDirs: mapPaths(meta.frontendDirs),
    backendDirs: mapPaths(meta.backendDirs),
    trpcRouterPaths: mapPaths(meta.trpcRouterPaths),
    tsrpcServicePaths: mapPaths(meta.tsrpcServicePaths),
    tsrpcApiDirs: mapPaths(meta.tsrpcApiDirs),
    tsrpcProtocolDirs: mapPaths(meta.tsrpcProtocolDirs),
    tsrpcServiceProto: meta.tsrpcServiceProto
      ? rebasePath(meta.tsrpcServiceProto, fromRoot, projectRoot)
      : undefined,
    prismaSchemaPath: meta.prismaSchemaPath
      ? rebasePath(meta.prismaSchemaPath, fromRoot, projectRoot)
      : null,
    typeormEntityDirs: mapPaths(meta.typeormEntityDirs),
    tsConfigPath: meta.tsConfigPath ? rebasePath(meta.tsConfigPath, fromRoot, projectRoot) : null,
    buildFile: meta.buildFile ? rebasePath(meta.buildFile, fromRoot, projectRoot) : null,
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const error = new Error('Project analysis was aborted')
  error.name = 'AbortError'
  throw error
}

function report(options: AnalyzeProjectOptions, phase: AnalysisProgressPhase, filesScanned?: number): void {
  throwIfAborted(options.signal)
  options.onProgress?.({ phase, ...(filesScanned === undefined ? {} : { filesScanned }) })
}

function serializableError(error: DbError | ProjectDetectionWarning): SerializableParseError {
  return {
    file: error.file,
    message: error.message,
    severity: error.severity,
    ...('parser' in error && error.parser ? { parser: error.parser } : {}),
    ...('code' in error && error.code ? { code: error.code } : {}),
  }
}

export async function analyzeProject(options: AnalyzeProjectOptions): Promise<import('@codeomnivis/shared').AnalyzeProjectResult> {
  report(options, 'detecting_project')
  const detectionWarnings: ProjectDetectionWarning[] = []
  const projectRoot = resolveProjectRoot(options.projectRoot)
  const projectMeta = options.projectMeta
    ? canonicalizeProvidedMeta(options.projectMeta, projectRoot)
    : await detectProject(
      projectRoot,
      options.config,
      warning => detectionWarnings.push(warning),
    )

  report(options, 'collecting_files')
  const files = collectAnalysisFiles(projectRoot, projectMeta)
  if (files.length === 0) {
    throw new AnalysisError('NO_SUPPORTED_FILES', 'No supported source files were found in the project')
  }
  const sourceDigest = computeSourceDigest(projectRoot, files)
  const fingerprint = computeProjectFingerprint(projectRoot, projectMeta, options.config)

  const scratch = new OmniDatabase(':memory:')
  const ownsStore = options.db === undefined
  const store = options.db ?? new OmniDatabase(options.dbPath ?? ':memory:')
  try {
    await Promise.all([scratch.ready(), store.ready()])
    report(options, 'parsing_files', files.length)
    const builder = new GraphBuilder(scratch)
    builder.registerParsers(createDefaultParsers())
    await builder.parseFiles(files, {
      projectRoot,
      projectMeta,
      tsConfig: null,
      pathAliases: {},
    })

    report(options, 'linking_graph', files.length)
    const linker = new CrossLayerLinker(projectMeta.tsConfigPath ?? undefined, projectRoot)
    const linked = await linker.link(scratch.loadGraph())
    if (linked.nodes.length > 0) scratch.upsertNodes(linked.nodes)
    if (linked.edges.length > 0) scratch.upsertEdges(linked.edges)
    scratch.removeDanglingEdges()

    report(options, 'validating_graph', files.length)
    const graph = sanitizeGraph(scratch.loadGraph()).graph
    if (graph.nodes.length === 0) {
      throw new AnalysisError('NO_GRAPH_NODES', 'Supported files were found, but no architecture nodes were recognized')
    }
    const parseErrors = [
      ...detectionWarnings.map(serializableError),
      ...scratch.getAllErrors().map(serializableError),
    ]

    report(options, 'detecting_issues', files.length)
    const issues = detectAnalysisIssues(graph, projectRoot, parseErrors)
    const now = Date.now()
    const snapshot: ProjectSnapshot = {
      schemaVersion: 1,
      snapshotId: randomUUID(),
      snapshotDigest: '',
      project: { root: projectRoot, fingerprint, meta: projectMeta },
      graph,
      issues,
      parseErrors,
      stats: createAnalysisStats(files.length, graph, issues, parseErrors),
      freshness: { state: 'fresh', lastAnalyzedAt: now, pendingChanges: 0 },
      provenance: {
        generatedAt: now,
        analyzerVersion: '0.0.1',
        filesScanned: files.length,
        sourceDigest,
      },
    }
    snapshot.snapshotDigest = computeSnapshotDigest(snapshot)

    report(options, 'committing_snapshot', files.length)
    const writeReport = replaceLegacySnapshot(store, snapshot)
    report(options, 'analysis_complete', files.length)
    return { snapshot, writeReport }
  } finally {
    scratch.close()
    if (ownsStore) store.close()
  }
}
