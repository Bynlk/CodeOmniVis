import * as fs from 'node:fs'
import * as path from 'node:path'
import fg from 'fast-glob'
import type { PackageInfo } from '@codeomnivis/shared'

interface PackageJson {
  name?: unknown
  dependencies?: unknown
  devDependencies?: unknown
  workspaces?: unknown
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}

function readJson(filePath: string): PackageJson | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function dependencyNames(value: unknown): string[] {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : []
}

function packageJsonWorkspacePatterns(root: string): string[] {
  const pkg = readJson(path.join(root, 'package.json'))
  if (!pkg) return []
  if (Array.isArray(pkg.workspaces)) {
    return pkg.workspaces.filter((item): item is string => typeof item === 'string')
  }
  if (pkg.workspaces !== null && typeof pkg.workspaces === 'object') {
    const packages = (pkg.workspaces as { packages?: unknown }).packages
    return Array.isArray(packages)
      ? packages.filter((item): item is string => typeof item === 'string')
      : []
  }
  return []
}

function pnpmWorkspacePatterns(root: string): string[] {
  const workspacePath = path.join(root, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspacePath)) return []
  try {
    const patterns: string[] = []
    let inPackages = false
    for (const line of fs.readFileSync(workspacePath, 'utf8').split(/\r?\n/u)) {
      if (/^packages\s*:/u.test(line)) {
        inPackages = true
        continue
      }
      if (inPackages && /^\S/u.test(line)) break
      if (!inPackages) continue
      const match = line.match(/^\s*-\s*(?:'([^']+)'|"([^"]+)"|([^\s#]+))/u)
      const pattern = match?.[1] ?? match?.[2] ?? match?.[3]
      if (pattern) patterns.push(pattern)
    }
    return patterns
  } catch {
    return []
  }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function manifestPattern(pattern: string): string {
  const normalized = normalizePath(pattern).replace(/\/$/u, '')
  return normalized.startsWith('!')
    ? `!${normalized.slice(1)}/package.json`
    : `${normalized}/package.json`
}

export function discoverWorkspacePackages(root: string): PackageInfo[] {
  const patterns = [...new Set([
    ...pnpmWorkspacePatterns(root),
    ...packageJsonWorkspacePatterns(root),
  ])]
  if (patterns.length === 0 && fs.existsSync(path.join(root, 'turbo.json'))) {
    patterns.push('packages/*')
  }
  if (patterns.length === 0) return []

  const manifests = fg.sync(patterns.map(manifestPattern), {
    cwd: root,
    onlyFiles: true,
    unique: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.*/**'],
  })
  const packages: PackageInfo[] = []
  const realRoot = fs.realpathSync.native(root)
  for (const manifest of manifests) {
    const packageRoot = path.dirname(path.resolve(root, manifest))
    let realPackageRoot: string
    try {
      realPackageRoot = fs.realpathSync.native(packageRoot)
    } catch {
      continue
    }
    if (!isWithinRoot(realRoot, realPackageRoot)) continue
    const pkg = readJson(path.join(packageRoot, 'package.json'))
    if (!pkg) continue
    const relativePath = normalizePath(path.relative(realRoot, realPackageRoot))
    packages.push({
      name: typeof pkg.name === 'string' && pkg.name.length > 0 ? pkg.name : relativePath,
      path: relativePath,
      dependencies: dependencyNames(pkg.dependencies),
      devDependencies: dependencyNames(pkg.devDependencies),
    })
  }
  return packages.sort((left, right) => left.path.localeCompare(right.path))
}
