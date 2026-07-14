import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import fg from 'fast-glob'
import type { Command } from 'commander'
import { importJunitXml, OmniDatabase } from '@codeomnivis/analyzer'
import { computeSnapshotDigest, getDbPath } from '@codeomnivis/shared/node'

export interface TestImportOptions {
  project: string
  junit: string
}

export interface TestImportResult {
  importedFiles: number
  cases: number
  unmatched: number
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveInputs(projectRoot: string, pattern: string): string[] {
  const resolvedPattern = path.resolve(projectRoot, pattern)
  if (!inside(projectRoot, resolvedPattern))
    throw new Error('JUnit XML inputs must be inside the project')
  const files = fg.sync(pattern, {
    cwd: projectRoot,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  })
  const realRoot = fs.realpathSync.native(projectRoot)
  for (const file of files) {
    if (!inside(realRoot, fs.realpathSync.native(file)))
      throw new Error('JUnit XML inputs must be inside the project')
  }
  if (files.length === 0) throw new Error('No JUnit XML files matched')
  return files.sort()
}

export async function runTestImport(options: TestImportOptions): Promise<TestImportResult> {
  const projectRoot = path.resolve(options.project)
  if (!fs.statSync(projectRoot).isDirectory()) throw new Error('Project root must be a directory')
  const files = resolveInputs(projectRoot, options.junit)
  const db = new OmniDatabase(getDbPath(projectRoot))
  try {
    await db.ready()
    const snapshot = db.loadSnapshot()
    if (!snapshot) throw new Error('No committed project snapshot found; run analyze first')
    const imports = files.map((file) => importJunitXml(file, snapshot))
    const updated = {
      ...snapshot,
      snapshotId: randomUUID(),
      snapshotDigest: '',
      provenance: {
        ...snapshot.provenance,
        generatedAt: Date.now(),
        testRuns: [...(snapshot.provenance.testRuns ?? []), ...imports],
      },
    }
    updated.snapshotDigest = computeSnapshotDigest(updated)
    db.replaceSnapshot(updated)
    return {
      importedFiles: files.length,
      cases: imports.reduce((sum, item) => sum + item.cases.length, 0),
      unmatched: imports.reduce((sum, item) => sum + item.unmatched.length, 0),
    }
  } finally {
    db.close()
  }
}

export function testImportCommand(program: Command): void {
  program
    .command('test-import')
    .description('Import existing JUnit XML results without running tests')
    .requiredOption('-p, --project <path>', 'Project root')
    .requiredOption('--junit <file-or-glob>', 'JUnit XML file or glob inside the project')
    .action(async (options: TestImportOptions) => {
      const result = await runTestImport(options)
      process.stdout.write(
        `Imported ${result.cases} case result(s) from ${result.importedFiles} file(s); ${result.unmatched} unmatched.\n`,
      )
    })
}
