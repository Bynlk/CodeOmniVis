import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const GLOBAL_THRESHOLDS = {
  lines: 85,
  statements: 85,
  functions: 85,
  branches: 80,
}
const CHANGED_LINES_THRESHOLD = 90

export function lineCoverage(fileCoverage) {
  const lineHits = new Map()
  for (const [id, location] of Object.entries(fileCoverage.statementMap ?? {})) {
    const line = location.start.line
    const hits = fileCoverage.s?.[id] ?? 0
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits))
  }
  const total = lineHits.size
  const covered = [...lineHits.values()].filter(hits => hits > 0).length
  return { covered, total, pct: total === 0 ? 100 : covered / total * 100 }
}

function hasDeclareModifier(statement) {
  return statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false
}

export function hasRuntimeCode(source) {
  const sourceFile = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  return sourceFile.statements.some(statement => {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) return false
    if (hasDeclareModifier(statement)) return false
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (!clause) return true
      if (clause.isTypeOnly) return false
      if (clause.name) return true
      const bindings = clause.namedBindings
      return !bindings || ts.isNamespaceImport(bindings)
        || bindings.elements.some(element => !element.isTypeOnly)
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) return false
      const exports = statement.exportClause
      return !exports || ts.isNamespaceExport(exports)
        || exports.elements.some(element => !element.isTypeOnly)
    }
    return true
  })
}

export function validateGlobalCoverage(summary) {
  const errors = []
  for (const [metric, threshold] of Object.entries(GLOBAL_THRESHOLDS)) {
    const pct = Number(summary?.total?.[metric]?.pct)
    if (!Number.isFinite(pct) || pct < threshold) {
      const rendered = Number.isFinite(pct) ? pct.toFixed(2) : 'missing'
      errors.push(`global ${metric} ${rendered}% is below ${threshold}%`)
    }
  }
  return errors
}

export function validatePackageLineCoverage(
  coverage,
  projectRoot,
  packageName,
  threshold,
) {
  const sourceRoot = `${resolve(projectRoot, 'packages', packageName, 'src')}${sep}`
  let covered = 0
  let total = 0
  for (const [filePath, fileCoverage] of Object.entries(coverage)) {
    if (!resolve(filePath).startsWith(sourceRoot)) continue
    const lines = lineCoverage(fileCoverage)
    covered += lines.covered
    total += lines.total
  }
  const pct = total === 0 ? 0 : covered / total * 100
  return pct < threshold
    ? [`${packageName} lines ${pct.toFixed(2)}% is below ${threshold}%`]
    : []
}

export function validateChangedCoverage(coverage, changedFiles, projectRoot) {
  const byPath = new Map(
    Object.entries(coverage).map(([filePath, value]) => [resolve(filePath), value]),
  )
  const errors = []
  for (const relativePath of changedFiles) {
    const fileCoverage = byPath.get(resolve(projectRoot, relativePath))
    if (!fileCoverage) {
      errors.push(`${relativePath} is absent from coverage/coverage-final.json`)
      continue
    }
    const { pct } = lineCoverage(fileCoverage)
    if (pct < CHANGED_LINES_THRESHOLD) {
      errors.push(
        `${relativePath} line coverage ${pct.toFixed(2)}% is below ${CHANGED_LINES_THRESHOLD}%`,
      )
    }
  }
  return errors
}

function git(args, projectRoot) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim()
}

function resolveBaseRevision(projectRoot) {
  if (process.env.QUALITY_BASE_SHA) return process.env.QUALITY_BASE_SHA
  try {
    return git(['merge-base', 'origin/master', 'HEAD'], projectRoot)
  } catch {
    return git(['rev-parse', 'HEAD^'], projectRoot)
  }
}

function changedProductionFiles(projectRoot) {
  const base = resolveBaseRevision(projectRoot)
  const output = git(['diff', '--name-only', base, '--', 'packages'], projectRoot)
  return output
    .split('\n')
    .filter(Boolean)
    .filter(filePath => /^packages\/[^/]+\/src\/.*\.(?:ts|tsx)$/u.test(filePath))
    .filter(filePath => !filePath.endsWith('.d.ts'))
    .filter(filePath => existsSync(resolve(projectRoot, filePath)))
    .filter(filePath => hasRuntimeCode(readFileSync(resolve(projectRoot, filePath), 'utf8')))
    .sort()
}

export function main(projectRoot = process.cwd()) {
  const coverage = JSON.parse(
    readFileSync(resolve(projectRoot, 'coverage/coverage-final.json'), 'utf8'),
  )
  const summary = JSON.parse(
    readFileSync(resolve(projectRoot, 'coverage/coverage-summary.json'), 'utf8'),
  )
  const changedFiles = changedProductionFiles(projectRoot)
  const errors = [
    ...validateGlobalCoverage(summary),
    ...validatePackageLineCoverage(coverage, projectRoot, 'analyzer', 85),
    ...validatePackageLineCoverage(coverage, projectRoot, 'server', 85),
    ...validateChangedCoverage(coverage, changedFiles, projectRoot),
  ]

  if (errors.length > 0) {
    process.stderr.write(`Coverage gate failed:\n${errors.map(error => `- ${error}`).join('\n')}\n`)
    process.exitCode = 1
    return
  }

  process.stdout.write(
    `Coverage gate passed: global thresholds and ${changedFiles.length} changed source files verified.\n`,
  )
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (entry === import.meta.url) main()
