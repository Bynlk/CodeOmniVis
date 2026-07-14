import * as fs from 'fs'
import * as path from 'path'
import type { ProjectMeta } from '@codeomnivis/shared'

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.kt', '.kts', '.prisma'])
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
])

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}

function resolveCandidate(projectRoot: string, candidate: string): string {
  return path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(projectRoot, candidate)
}

function isWithinRoot(projectRoot: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function scanDirectory(
  projectRoot: string,
  realProjectRoot: string,
  directory: string,
  visitFile: (filePath: string) => void,
  visitedDirectories: Set<string>,
): void {
  let realDirectory: string
  try {
    realDirectory = fs.realpathSync.native(directory)
  } catch {
    return
  }
  const lexicalRelative = path.relative(path.resolve(projectRoot), path.resolve(directory))
  const realRelative = path.relative(realProjectRoot, realDirectory)
  const lexicalInside =
    lexicalRelative === '' ||
    (!lexicalRelative.startsWith('..') && !path.isAbsolute(lexicalRelative))
  const realInside =
    realRelative === '' || (!realRelative.startsWith('..') && !path.isAbsolute(realRelative))
  // A path explicitly configured outside root is allowed, but a path that appears inside root
  // must never escape through a symlink.
  if (lexicalInside && !realInside) return
  if (visitedDirectories.has(realDirectory)) return
  visitedDirectories.add(realDirectory)

  try {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || IGNORED_DIRECTORIES.has(entry.name)) continue
      const entryPath = path.join(directory, entry.name)

      let stats: fs.Stats
      try {
        stats = fs.statSync(entryPath)
      } catch {
        continue
      }
      if (stats.isDirectory()) {
        scanDirectory(projectRoot, realProjectRoot, entryPath, visitFile, visitedDirectories)
      } else if (stats.isFile() && isSupportedFile(entryPath)) {
        visitFile(entryPath)
      }
    }
  } catch {
    // An unreadable source subtree must not abort analysis of the remaining project.
  }
}

function collectCandidateDirectories(projectRoot: string, projectMeta: ProjectMeta): string[] {
  const candidates = new Set<string>([
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
    'test',
    'tests',
    '__tests__',
    'e2e',
    'cypress/e2e',
    ...projectMeta.frontendDirs,
    ...projectMeta.backendDirs,
    ...projectMeta.tsrpcApiDirs,
    ...projectMeta.tsrpcProtocolDirs,
    ...projectMeta.typeormEntityDirs,
  ])

  const realProjectRoot = fs.realpathSync.native(projectRoot)
  for (const workspacePackage of projectMeta.packages) {
    const packageRoot = resolveCandidate(projectRoot, workspacePackage.path)
    let realPackageRoot: string
    try {
      realPackageRoot = fs.realpathSync.native(packageRoot)
    } catch {
      continue
    }
    if (!isWithinRoot(realProjectRoot, realPackageRoot)) continue
    for (const child of [
      'src',
      'app',
      'pages',
      'components',
      'server',
      'api',
      'prisma',
      'test',
      'tests',
      '__tests__',
      'e2e',
      'cypress/e2e',
    ]) {
      candidates.add(path.join(packageRoot, child))
    }
  }

  return [...candidates].map((candidate) => resolveCandidate(projectRoot, candidate))
}

function collectExplicitFiles(projectMeta: ProjectMeta): string[] {
  return [
    projectMeta.prismaSchemaPath,
    ...projectMeta.trpcRouterPaths,
    ...projectMeta.tsrpcServicePaths,
    projectMeta.tsrpcServiceProto,
    projectMeta.buildFile,
  ].filter((filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0)
}

export function collectAnalysisFiles(projectRoot: string, projectMeta: ProjectMeta): string[] {
  const filesByRealPath = new Map<string, string>()
  const addFile = (filePath: string): void => {
    const absolutePath = resolveCandidate(projectRoot, filePath)
    if (!isSupportedFile(absolutePath)) return
    try {
      if (!fs.statSync(absolutePath).isFile()) return
      const realPath = fs.realpathSync.native(absolutePath)
      if (!filesByRealPath.has(realPath)) {
        filesByRealPath.set(realPath, normalizePath(path.relative(projectRoot, absolutePath)))
      }
    } catch {
      // Explicit optional inputs may disappear between detection and analysis.
    }
  }

  const visitedDirectories = new Set<string>()
  const realProjectRoot = fs.realpathSync.native(projectRoot)
  for (const directory of collectCandidateDirectories(projectRoot, projectMeta)) {
    scanDirectory(projectRoot, realProjectRoot, directory, addFile, visitedDirectories)
  }
  for (const filePath of collectExplicitFiles(projectMeta)) addFile(filePath)

  return [...filesByRealPath.values()].sort()
}

/** Compatibility scanner for callers that already selected one source directory. */
export function collectSourceFiles(directory: string, projectRoot: string): string[] {
  const filesByRealPath = new Map<string, string>()
  const addFile = (filePath: string): void => {
    if (!isSupportedFile(filePath)) return
    try {
      const realPath = fs.realpathSync.native(filePath)
      if (!filesByRealPath.has(realPath)) {
        filesByRealPath.set(realPath, normalizePath(path.relative(projectRoot, filePath)))
      }
    } catch {
      // A file may disappear while its directory is being traversed.
    }
  }
  const realProjectRoot = fs.realpathSync.native(projectRoot)
  scanDirectory(projectRoot, realProjectRoot, directory, addFile, new Set())
  return [...filesByRealPath.values()].sort()
}
