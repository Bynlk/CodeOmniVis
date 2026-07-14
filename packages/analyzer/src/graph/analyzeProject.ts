import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import type {
  CodeOmniVisConfig,
  ProjectSnapshot,
  ProjectMeta,
  SerializableParseError,
  ParseError,
} from '@codeomnivis/shared'
import { computeSnapshotDigest } from '@codeomnivis/shared/node'
import { CrossLayerLinker } from '../resolver/crossLayer'
import { OmniDatabase, type AnalysisStore, type DbError } from '../storage/db'
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
import { createDefaultTestAdapters, discoverTests, linkTestsToProduction } from '../tests'

export type { AnalysisStore } from '../storage/db'

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

function serializableError(error: DbError | ProjectDetectionWarning | ParseError): SerializableParseError {
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
    const buildResult = await builder.parseFiles(files, {
      projectRoot,
      projectMeta,
      tsConfig: null,
      pathAliases: {},
    })

    report(options, 'linking_graph', files.length)
    const testNodes = new Map<string, ProjectSnapshot['graph']['nodes'][number]>()
    const testEdges = new Map<string, ProjectSnapshot['graph']['edges'][number]>()
    const testErrors: import('@codeomnivis/shared').ParseError[] = []
    const testContext = {
      projectRoot,
      projectMeta,
      tsConfig: null,
      pathAliases: {},
      knownProductionNodes: buildResult.graph.nodes,
    }
    const adapters = createDefaultTestAdapters()
    for (const file of files) {
      const discovered = await discoverTests(file, testContext, adapters)
      for (const node of discovered.nodes) testNodes.set(node.id, node)
      for (const edge of discovered.edges) testEdges.set(edge.id, edge)
      testErrors.push(...discovered.errors)
    }
    const testGraph = linkTestsToProduction(
      { nodes: [...testNodes.values()], edges: [...testEdges.values()], errors: testErrors },
      buildResult.graph.nodes,
      projectRoot,
    )
    const graphWithTests = {
      nodes: [...buildResult.graph.nodes, ...testGraph.nodes],
      edges: [...buildResult.graph.edges, ...testGraph.edges],
    }

    const linker = new CrossLayerLinker(projectMeta.tsConfigPath ?? undefined, projectRoot)
    const linked = await linker.link(graphWithTests)

    report(options, 'validating_graph', files.length)
    const graph = sanitizeGraph({
      nodes: graphWithTests.nodes,
      edges: [...graphWithTests.edges, ...linked.edges],
    }).graph
    if (graph.nodes.length === 0) {
      throw new AnalysisError('NO_GRAPH_NODES', 'Supported files were found, but no architecture nodes were recognized')
    }
    const parseErrors = [
      ...detectionWarnings.map(serializableError),
      ...scratch.getAllErrors().map(serializableError),
      ...testErrors.map(serializableError),
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
    let writeReport
    try {
      writeReport = store.replaceSnapshot(snapshot)
    } catch (cause) {
      throw new AnalysisError(
        'STORAGE_FAILURE',
        'Snapshot persistence failed; the previous snapshot remains available',
        { cause },
      )
    }
    report(options, 'analysis_complete', files.length)
    return { snapshot, writeReport }
  } finally {
    scratch.close()
    if (ownsStore) store.close()
  }
}
