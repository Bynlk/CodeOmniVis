import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeProject, OmniDatabase } from '@codeomnivis/analyzer'
import { getDbPath } from '@codeomnivis/shared/node'
import { runTestImport } from '../../src/commands/testImport'

describe('test-import command', () => {
  const roots: string[] = []
  afterEach(() =>
    roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })),
  )

  it('appends JUnit provenance through the transactional snapshot store', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-import-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'app'))
    fs.writeFileSync(
      path.join(root, 'app', 'page.tsx'),
      'export default function Home() { return <main /> }',
    )
    fs.writeFileSync(
      path.join(root, 'junit.xml'),
      '<testsuite name="Home"><testcase name="renders" time="0.01" /></testsuite>',
    )
    await analyzeProject({ projectRoot: root, dbPath: getDbPath(root) })
    const seeded = new OmniDatabase(getDbPath(root))
    await seeded.ready()
    expect(seeded.loadSnapshot()).not.toBeNull()
    seeded.close()

    const result = await runTestImport({ project: root, junit: 'junit.xml' })
    const db = new OmniDatabase(getDbPath(root))
    await db.ready()

    expect(result.importedFiles).toBe(1)
    expect(db.loadSnapshot()?.provenance.testRuns).toHaveLength(1)
    db.close()
  })

  it('rejects input outside the project before replacing the snapshot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-import-root-'))
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-import-outside-'))
    roots.push(root, outside)
    fs.mkdirSync(path.join(root, 'app'))
    fs.writeFileSync(
      path.join(root, 'app', 'page.tsx'),
      'export default function Home() { return <main /> }',
    )
    fs.writeFileSync(path.join(outside, 'junit.xml'), '<testsuite />')
    const before = await analyzeProject({ projectRoot: root, dbPath: getDbPath(root) })

    await expect(
      runTestImport({ project: root, junit: path.join(outside, 'junit.xml') }),
    ).rejects.toThrow('inside the project')
    const db = new OmniDatabase(getDbPath(root))
    await db.ready()
    expect(db.loadSnapshot()?.snapshotDigest).toBe(before.snapshot.snapshotDigest)
    db.close()
  })
})
