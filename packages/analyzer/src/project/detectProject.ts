import * as fs from 'node:fs'
import * as path from 'node:path'
import fg from 'fast-glob'
import type {
  CodeOmniVisConfig,
  DatabaseType,
  FrameworkType,
  ProjectMeta,
  SerializableParseError,
} from '@codeomnivis/shared'
import { readDependencies } from '@codeomnivis/shared'
import { detectGradleFrameworks } from '@codeomnivis/shared/node'
import { applyProjectConfig } from './configureProject'
import { discoverWorkspacePackages } from './workspacePackages'

export interface ProjectDetectionWarning extends SerializableParseError {
  code: string
  parser: 'project-detection'
}

export class ProjectDetectionError extends Error {
  readonly code = 'INVALID_PROJECT_ROOT'

  constructor(message: string) {
    super(message)
    this.name = 'ProjectDetectionError'
  }
}

export function resolveProjectRoot(projectRoot: string): string {
  try {
    const root = fs.realpathSync.native(path.resolve(projectRoot))
    if (!fs.statSync(root).isDirectory()) throw new Error('not a directory')
    return root
  } catch {
    throw new ProjectDetectionError('Project root must be an existing directory')
  }
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}

function warning(file: string, code: string, message: string): ProjectDetectionWarning {
  return { file, code, message, severity: 'warning', parser: 'project-detection' }
}

function readManifest(
  filePath: string,
  onWarning?: (warning: ProjectDetectionWarning) => void,
): unknown {
  if (!fs.existsSync(filePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
  } catch {
    onWarning?.(warning(filePath, 'PROJECT_MANIFEST_INVALID', 'Project manifest is not valid JSON'))
    return {}
  }
}

function mergeDependencies(target: Record<string, string>, manifest: unknown): void {
  Object.assign(target, readDependencies(manifest))
}

function detectFrontend(root: string, dependencies: Record<string, string>): FrameworkType {
  if (dependencies.next) return 'next'
  const nextConventions = [
    'app/page.tsx',
    'app/page.ts',
    'src/app/page.tsx',
    'src/app/page.ts',
    'pages/index.tsx',
    'pages/index.ts',
    'src/pages/index.tsx',
    'src/pages/index.ts',
  ]
  return nextConventions.some((candidate) => fs.existsSync(path.join(root, candidate)))
    ? 'next'
    : 'unknown'
}

function detectBackend(dependencies: Record<string, string>): FrameworkType {
  if (dependencies['@nestjs/core'] || dependencies['@nestjs/common']) return 'nestjs'
  if (
    dependencies['@trpc/server'] ||
    Object.keys(dependencies).some((name) => name.endsWith('/trpc'))
  ) {
    return 'trpc'
  }
  if (dependencies.tsrpc || dependencies['tsrpc-browser'] || dependencies['tsrpc-base-client']) {
    return 'tsrpc'
  }
  if (dependencies.express) return 'express'
  return 'unknown'
}

function firstExisting(root: string, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(root, candidate))) return normalizePath(candidate)
  }
  return null
}

function findPrismaSchema(root: string): string | null {
  const direct = firstExisting(root, [
    'prisma/schema.prisma',
    'schema.prisma',
    'src/prisma/schema.prisma',
    'packages/prisma/prisma/schema.prisma',
    'packages/prisma/schema.prisma',
    'packages/db/prisma/schema.prisma',
    'packages/database/prisma/schema.prisma',
  ])
  if (direct) return direct
  return (
    fg
      .sync('packages/*/{prisma/,}schema.prisma', {
        cwd: root,
        onlyFiles: true,
        followSymbolicLinks: false,
      })
      .map(normalizePath)
      .sort()[0] ?? null
  )
}

function detectDatabase(root: string, dependencies: Record<string, string>): DatabaseType {
  if (findPrismaSchema(root) || dependencies.prisma || dependencies['@prisma/client'])
    return 'prisma'
  if (dependencies['drizzle-orm']) return 'drizzle'
  if (dependencies.typeorm) return 'typeorm'
  return 'unknown'
}

function detectMonorepo(root: string): ProjectMeta['monorepoType'] {
  if (fs.existsSync(path.join(root, 'turbo.json'))) return 'turborepo'
  if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) return 'pnpm'
  return 'none'
}

function existingDirectories(root: string, candidates: readonly string[]): string[] {
  return candidates.filter((candidate) => {
    try {
      return fs.statSync(path.resolve(root, candidate)).isDirectory()
    } catch {
      return false
    }
  })
}

function findTrpcRouters(root: string): string[] {
  return fg
    .sync(
      [
        '{server,src/server}/{router,routers}/**/*.{ts,tsx}',
        '{api,src/api}/trpc/**/*.{ts,tsx}',
        'packages/*/{src/,}{server/,}{router,routers}/**/*.{ts,tsx}',
      ],
      {
        cwd: root,
        onlyFiles: true,
        followSymbolicLinks: false,
        ignore: ['**/node_modules/**', '**/dist/**'],
      },
    )
    .map(normalizePath)
    .sort()
}

function findTsrpcPaths(root: string): {
  servicePaths: string[]
  apiDirs: string[]
  protocolDirs: string[]
  serviceProto?: string
} {
  const files = fg
    .sync(['{src/,}{api,server/api,protocols,shared/protocols}/**/*.{ts,tsx}'], {
      cwd: root,
      onlyFiles: true,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**', '**/dist/**'],
    })
    .map(normalizePath)
    .sort()
  const servicePaths = files.filter((file) => {
    try {
      const content = fs.readFileSync(path.join(root, file), 'utf8')
      return content.includes('ApiCall') || content.includes('tsrpc')
    } catch {
      return false
    }
  })
  const apiDirs = existingDirectories(root, ['src/api', 'api', 'src/server/api', 'server/api'])
  const protocolDirs = existingDirectories(root, [
    'src/shared/protocols',
    'shared/protocols',
    'protocols',
    'src/protocols',
  ])
  const serviceProto = files.find((file) => path.basename(file) === 'serviceProto.ts')
  return { servicePaths, apiDirs, protocolDirs, serviceProto }
}

function findTypeormDirs(root: string): string[] {
  return existingDirectories(root, [
    'entity',
    'entities',
    'src/entity',
    'src/entities',
    'model',
    'models',
    'src/model',
    'src/models',
  ]).filter((directory) => fg.sync('*.{ts,tsx}', { cwd: path.join(root, directory) }).length > 0)
}

export async function detectProject(
  projectRoot: string,
  config?: CodeOmniVisConfig,
  onWarning?: (warning: ProjectDetectionWarning) => void,
): Promise<ProjectMeta> {
  const root = resolveProjectRoot(projectRoot)

  const dependencies: Record<string, string> = {}
  mergeDependencies(dependencies, readManifest(path.join(root, 'package.json'), onWarning))
  for (const child of ['frontend', 'backend', 'apps/web', 'app']) {
    mergeDependencies(dependencies, readManifest(path.join(root, child, 'package.json'), onWarning))
  }
  const packages = discoverWorkspacePackages(root)
  for (const pkg of packages) {
    for (const dependency of [...pkg.dependencies, ...pkg.devDependencies])
      dependencies[dependency] = '*'
  }

  let backendFramework = detectBackend(dependencies)
  if (backendFramework === 'unknown' && fs.existsSync(path.join(root, 'tsrpc.config.ts'))) {
    backendFramework = 'tsrpc'
  }
  let databaseType = detectDatabase(root, dependencies)
  const gradle = detectGradleFrameworks(root)
  if (backendFramework === 'unknown') backendFramework = gradle.backendFramework
  if (databaseType === 'unknown') databaseType = gradle.databaseType
  const tsrpc = findTsrpcPaths(root)
  const workspaceFrontendDirs = packages
    .filter((pkg) =>
      [...pkg.dependencies, ...pkg.devDependencies].some(
        (dep) => dep === 'next' || dep === 'react',
      ),
    )
    .map((pkg) => `${pkg.path}/src`)
  const workspaceBackendDirs = packages
    .filter((pkg) =>
      [...pkg.dependencies, ...pkg.devDependencies].some(
        (dep) =>
          dep === 'express' || dep === '@trpc/server' || dep === '@nestjs/core' || dep === 'tsrpc',
      ),
    )
    .map((pkg) => `${pkg.path}/src`)

  return applyProjectConfig(
    {
      root,
      frontendFramework: detectFrontend(root, dependencies),
      backendFramework,
      databaseType,
      monorepoType: detectMonorepo(root),
      frontendDirs: [
        ...(fs.existsSync(path.join(root, 'frontend', 'src'))
          ? ['frontend/src']
          : [
              'app',
              'src/app',
              'pages',
              'src/pages',
              'components',
              'src/components',
              'hooks',
              'src/hooks',
              'lib',
              'src/lib',
              'features',
              'src/features',
              'services',
              'src/services',
            ]),
        ...workspaceFrontendDirs,
      ],
      backendDirs: [
        ...(fs.existsSync(path.join(root, 'backend', 'src'))
          ? ['backend/src']
          : ['server', 'src/server', 'api', 'src/api']),
        ...workspaceBackendDirs,
      ],
      trpcRouterPaths: findTrpcRouters(root),
      tsrpcServicePaths: tsrpc.servicePaths,
      tsrpcApiDirs: tsrpc.apiDirs,
      tsrpcProtocolDirs: tsrpc.protocolDirs,
      tsrpcServiceProto: tsrpc.serviceProto,
      prismaSchemaPath: findPrismaSchema(root),
      typeormEntityDirs: findTypeormDirs(root),
      tsConfigPath: (() => {
        const relative = firstExisting(root, [
          'tsconfig.json',
          'apps/web/tsconfig.json',
          'app/tsconfig.json',
          'src/tsconfig.json',
        ])
        return relative ? path.join(root, relative) : null
      })(),
      buildFile: gradle.buildFile,
      packages,
    },
    config,
  )
}
