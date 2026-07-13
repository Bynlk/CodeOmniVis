import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { OmniDatabase } from '../../src/storage/db'
import { runAnalysis } from '../../src/graph/runAnalysis'
import { CrossLayerLinker } from '../../src/resolver/crossLayer'
import type { OmniNode, ProjectMeta } from '@codeomnivis/shared'

describe('runAnalysis graph replacement', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  })

  it('removes nodes from a previous analysis before persisting the new graph', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-reanalysis-'))
    roots.push(projectRoot)
    fs.mkdirSync(path.join(projectRoot, 'app'))
    fs.writeFileSync(path.join(projectRoot, 'app', 'page.tsx'), 'export default function Page() { return null }')

    const db = new OmniDatabase(':memory:')
    await db.ready()
    const stale: OmniNode = {
      id: 'component:components/Deleted.tsx:Deleted', type: 'component', name: 'Deleted',
      filePath: 'components/Deleted.tsx', line: 1, column: 1,
      metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 0 },
    }
    db.upsertNode(stale)

    await runAnalysis({ projectRoot, dbPath: ':memory:', db })

    expect(db.getNode(stale.id)).toBeNull()
    expect(db.getAllNodes().some(node => node.type === 'page')).toBe(true)
  })

  it('does not retain unresolved API placeholder edges in the persisted graph', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-dangling-calls-'))
    roots.push(projectRoot)
    fs.mkdirSync(path.join(projectRoot, 'components'), { recursive: true })
    fs.writeFileSync(
      path.join(projectRoot, 'components', 'Caller.tsx'),
      'export function Caller() { fetch("/api/missing"); return null }',
    )

    const db = new OmniDatabase(':memory:')
    await db.ready()
    await runAnalysis({ projectRoot, dbPath: ':memory:', db })

    const nodeIds = new Set(db.getAllNodes().map(node => node.id))
    expect(db.getAllEdges().every(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true)
  })

  it('re-analyzes source directories supplied by detected project metadata', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-split-reanalysis-'))
    roots.push(projectRoot)
    const frontendSrc = path.join(projectRoot, 'frontend', 'src')
    fs.mkdirSync(frontendSrc, { recursive: true })
    fs.writeFileSync(
      path.join(frontendSrc, 'App.tsx'),
      'export function App() { return <main>ready</main> }',
    )

    const projectMeta: ProjectMeta = {
      root: projectRoot,
      frontendFramework: 'unknown',
      backendFramework: 'unknown',
      databaseType: 'unknown',
      monorepoType: 'none',
      frontendDirs: [frontendSrc],
      backendDirs: [],
      trpcRouterPaths: [],
      tsrpcServicePaths: [],
      tsrpcApiDirs: [],
      tsrpcProtocolDirs: [],
      prismaSchemaPath: null,
      typeormEntityDirs: [],
      tsConfigPath: null,
      buildFile: null,
      packages: [],
    }

    const db = new OmniDatabase(':memory:')
    await db.ready()
    const result = await runAnalysis({ projectRoot, dbPath: ':memory:', db, projectMeta })

    expect(result.filesScanned).toBe(1)
    const appNode = db.getAllNodes().find(node => node.name === 'App')
    expect(appNode).toBeDefined()
    expect(appNode?.filePath).toBe('frontend/src/App.tsx')
  })

  it('scans source files declared through workspace package metadata', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-workspace-analysis-'))
    roots.push(projectRoot)
    const packageSrc = path.join(projectRoot, 'packages', 'ui', 'src')
    fs.mkdirSync(packageSrc, { recursive: true })
    fs.writeFileSync(
      path.join(packageSrc, 'WorkspacePanel.tsx'),
      'export function WorkspacePanel() { return <section>workspace</section> }',
    )

    const projectMeta: ProjectMeta = {
      root: projectRoot,
      frontendFramework: 'unknown',
      backendFramework: 'unknown',
      databaseType: 'unknown',
      monorepoType: 'pnpm',
      frontendDirs: [],
      backendDirs: [],
      trpcRouterPaths: [],
      tsrpcServicePaths: [],
      tsrpcApiDirs: [],
      tsrpcProtocolDirs: [],
      prismaSchemaPath: null,
      typeormEntityDirs: [],
      tsConfigPath: null,
      buildFile: null,
      packages: [{
        name: '@fixture/ui',
        path: 'packages/ui',
        dependencies: ['react'],
        devDependencies: [],
      }],
    }

    const db = new OmniDatabase(':memory:')
    await db.ready()
    const result = await runAnalysis({ projectRoot, dbPath: ':memory:', db, projectMeta })

    expect(result.filesScanned).toBe(1)
    expect(db.getAllNodes().some(node => node.name === 'WorkspacePanel')).toBe(true)
  })

  it('rejects an analysis with no supported source files', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-empty-analysis-'))
    roots.push(projectRoot)

    await expect(runAnalysis({ projectRoot, dbPath: ':memory:' })).rejects.toMatchObject({
      code: 'NO_SUPPORTED_FILES',
    })
  })

  it('rejects supported files that produce no architecture nodes', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-no-nodes-'))
    roots.push(projectRoot)
    fs.mkdirSync(path.join(projectRoot, 'src'))
    fs.writeFileSync(path.join(projectRoot, 'src', 'constants.ts'), 'export const ANSWER = 42')

    await expect(runAnalysis({ projectRoot, dbPath: ':memory:' })).rejects.toMatchObject({
      code: 'NO_GRAPH_NODES',
    })
  })

  it('keeps a non-empty graph when another parser degrades with an error', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-partial-analysis-'))
    roots.push(projectRoot)
    fs.mkdirSync(path.join(projectRoot, 'src'))
    fs.mkdirSync(path.join(projectRoot, 'prisma'))
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'App.tsx'),
      'export function App() { return <main>ready</main> }',
    )
    fs.writeFileSync(path.join(projectRoot, 'prisma', 'schema.prisma'), 'model {')

    const result = await runAnalysis({ projectRoot, dbPath: ':memory:' })

    expect(result.nodesCreated).toBeGreaterThan(0)
    expect(result.errors).toBeGreaterThan(0)
  })

  it('closes an owned database when cross-layer linking fails', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analysis-cleanup-'))
    roots.push(projectRoot)
    fs.mkdirSync(path.join(projectRoot, 'app'))
    fs.writeFileSync(path.join(projectRoot, 'app', 'page.tsx'), 'export default function Page() { return null }')
    const closeSpy = vi.spyOn(OmniDatabase.prototype, 'close')
    const linkSpy = vi.spyOn(CrossLayerLinker.prototype, 'link').mockRejectedValueOnce(new Error('link failed'))

    await expect(runAnalysis({ projectRoot, dbPath: ':memory:' })).rejects.toThrow('link failed')
    expect(closeSpy).toHaveBeenCalledTimes(1)

    linkSpy.mockRestore()
    closeSpy.mockRestore()
  })
})
