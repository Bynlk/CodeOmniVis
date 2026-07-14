import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OmniNode } from '@codeomnivis/shared'
import { analyzeProject } from '../../src/graph/analyzeProject'
import { OmniDatabase } from '../../src/storage/db'

describe('analyzeProject', () => {
  const roots: string[] = []
  const databases: OmniDatabase[] = []

  function project(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analyze-project-'))
    roots.push(root)
    return root
  }

  async function database(): Promise<OmniDatabase> {
    const db = new OmniDatabase(':memory:')
    databases.push(db)
    await db.ready()
    return db
  }

  afterEach(() => {
    for (const db of databases.splice(0)) db.close()
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns and commits one versioned snapshot with stable progress phases', async () => {
    const root = project()
    fs.mkdirSync(path.join(root, 'app'))
    fs.writeFileSync(
      path.join(root, 'app', 'page.tsx'),
      'export default function Home() { return <main>ready</main> }',
    )
    const db = await database()
    const phases: string[] = []

    const result = await analyzeProject({
      projectRoot: root,
      db,
      onProgress: (event) => phases.push(event.phase),
    })

    expect(result.snapshot.schemaVersion).toBe(1)
    expect(result.snapshot.snapshotDigest).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.snapshot.graph.nodes.length).toBeGreaterThan(0)
    expect(result.writeReport.committed).toBe(true)
    expect(db.loadGraph()).toEqual(result.snapshot.graph)
    expect(phases).toEqual([
      'detecting_project',
      'collecting_files',
      'parsing_files',
      'linking_graph',
      'validating_graph',
      'detecting_issues',
      'committing_snapshot',
      'analysis_complete',
    ])
  })

  it('preserves useful nodes when another parser degrades with a warning', async () => {
    const root = project()
    fs.mkdirSync(path.join(root, 'src'))
    fs.mkdirSync(path.join(root, 'prisma'))
    fs.writeFileSync(
      path.join(root, 'src', 'App.tsx'),
      'export function App() { return <main>ready</main> }',
    )
    fs.writeFileSync(path.join(root, 'prisma', 'schema.prisma'), 'model {')

    const result = await analyzeProject({ projectRoot: root })

    expect(result.snapshot.graph.nodes.some((node) => node.name === 'App')).toBe(true)
    expect(result.snapshot.parseErrors.length).toBeGreaterThan(0)
    expect(result.snapshot.parseErrors.every((error) => !('originalError' in error))).toBe(true)
  })

  it('records a malformed optional manifest as a controlled parse warning', async () => {
    const root = project()
    fs.writeFileSync(path.join(root, 'package.json'), '{ bad json')
    fs.mkdirSync(path.join(root, 'components'))
    fs.writeFileSync(
      path.join(root, 'components', 'Panel.tsx'),
      'export function Panel() { return <aside /> }',
    )

    const result = await analyzeProject({ projectRoot: root })

    expect(result.snapshot.parseErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_MANIFEST_INVALID', severity: 'warning' }),
      ]),
    )
  })

  it('does not follow a source-directory symlink outside the project root', async () => {
    const root = project()
    const outside = project()
    fs.mkdirSync(path.join(root, 'app'))
    fs.writeFileSync(
      path.join(root, 'app', 'page.tsx'),
      'export default function Home() { return <main /> }',
    )
    fs.writeFileSync(
      path.join(outside, 'Outside.tsx'),
      'export function Outside() { return <div /> }',
    )
    fs.symlinkSync(outside, path.join(root, 'components'), 'dir')

    const result = await analyzeProject({ projectRoot: root })

    expect(result.snapshot.graph.nodes.some((node) => node.name === 'Outside')).toBe(false)
  })

  it('rejects an empty project with a typed unsupported-input error', async () => {
    const root = project()

    await expect(analyzeProject({ projectRoot: root })).rejects.toMatchObject({
      code: 'NO_SUPPORTED_FILES',
    })
  })

  it('rolls back the target database when snapshot persistence fails', async () => {
    const root = project()
    fs.mkdirSync(path.join(root, 'app'))
    fs.writeFileSync(
      path.join(root, 'app', 'page.tsx'),
      'export default function Home() { return <main /> }',
    )
    const db = await database()
    const previous: OmniNode = {
      id: 'component:components/Previous.tsx:Previous',
      type: 'component',
      name: 'Previous',
      filePath: 'components/Previous.tsx',
      line: 1,
      column: 1,
      metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
    }
    db.upsertNode(previous)
    vi.spyOn(db, 'replaceSnapshot').mockImplementationOnce(() => {
      throw new Error('injected storage failure')
    })

    await expect(analyzeProject({ projectRoot: root, db })).rejects.toMatchObject({
      code: 'STORAGE_FAILURE',
    })
    expect(db.loadGraph()).toEqual({ nodes: [previous], edges: [] })
  })
})
