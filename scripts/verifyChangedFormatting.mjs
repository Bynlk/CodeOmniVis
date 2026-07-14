import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const FORMATTABLE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.mts',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])
const EXCLUDED_SEGMENTS = new Set([
  '.Codex',
  '.codex',
  '.planning',
  '.superpowers',
  '.turbo',
  '.worktrees',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])

export function isFormattablePath(filePath) {
  if (!filePath) return false
  const normalized = filePath.replaceAll('\\', '/')
  if (normalized.endsWith('pnpm-lock.yaml')) return false
  if (normalized.split('/').some((segment) => EXCLUDED_SEGMENTS.has(segment))) return false
  return FORMATTABLE_EXTENSIONS.has(extname(normalized).toLowerCase())
}

function git(args, projectRoot, allowFailure = false) {
  const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' })
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
  }
  return result.status === 0 ? result.stdout.trim() : ''
}

function resolveBaseRevision(projectRoot) {
  if (process.env.QUALITY_BASE_SHA) return process.env.QUALITY_BASE_SHA
  const mergeBase = git(['merge-base', 'origin/master', 'HEAD'], projectRoot, true)
  return mergeBase || git(['rev-parse', 'HEAD^'], projectRoot)
}

export function changedFormattableFiles(projectRoot) {
  const base = resolveBaseRevision(projectRoot)
  const tracked = git(['diff', '--name-only', '--diff-filter=ACMR', base, '--'], projectRoot)
  const untracked = git(['ls-files', '--others', '--exclude-standard'], projectRoot)
  return [...new Set(`${tracked}\n${untracked}`.split('\n'))]
    .filter(isFormattablePath)
    .filter((filePath) => existsSync(resolve(projectRoot, filePath)))
    .sort()
}

export function main(projectRoot = process.cwd(), write = process.argv.includes('--write')) {
  const files = changedFormattableFiles(projectRoot)
  if (files.length === 0) {
    process.stdout.write('Formatting gate passed: no changed formattable files.\n')
    return
  }
  try {
    execFileSync('pnpm', ['exec', 'prettier', write ? '--write' : '--check', ...files], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    process.stdout.write(
      write
        ? `Formatting applied: ${files.length} changed files.\n`
        : `Formatting gate passed: ${files.length} changed files verified.\n`,
    )
  } catch {
    process.exitCode = 1
  }
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (entry === import.meta.url) main()
