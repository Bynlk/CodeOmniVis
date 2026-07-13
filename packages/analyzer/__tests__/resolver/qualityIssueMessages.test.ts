import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { OmniGraph, OmniNode } from '@codeomnivis/shared'
import { NPlusOneDetector } from '../../src/resolver/nPlusOneDetector'
import { RSCBoundaryDetector } from '../../src/resolver/rscBoundaryDetector'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function createRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  roots.push(root)
  return root
}

describe('detector localization messages', () => {
  it('adds structured parameters to N+1 findings', () => {
    const root = createRoot('covis-n1-message-')
    const filePath = 'server/listUsers.ts'
    const absolute = path.join(root, filePath)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, [
      'export async function listUsers(ids: string[]) {',
      '  for (const id of ids) {',
      '    await prisma.user.findUnique({ where: { id } })',
      '  }',
      '}',
    ].join('\n'))
    const handler: OmniNode = {
      id: `handler:${filePath}:listUsers`,
      type: 'handler',
      name: 'listUsers',
      filePath,
      line: 1,
      column: 1,
      metadata: { functionName: 'listUsers', routeId: null },
    }

    const issues = new NPlusOneDetector().detect({ nodes: [handler], edges: [] }, root)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      messageKey: 'n_plus_one_query',
      messageParams: { model: 'User', operation: 'findUnique', loopType: 'for' },
    })
  })

  it('adds structured parameters to RSC boundary findings', () => {
    const root = createRoot('covis-rsc-message-')
    const serverPath = 'components/ServerPanel.tsx'
    const clientPath = 'components/ClientButton.tsx'
    fs.mkdirSync(path.join(root, 'components'), { recursive: true })
    fs.writeFileSync(
      path.join(root, serverPath),
      "import ClientButton from './ClientButton'\nexport default function ServerPanel() { return <ClientButton /> }",
    )
    fs.writeFileSync(
      path.join(root, clientPath),
      "'use client'\nexport default function ClientButton() { return <button /> }",
    )
    const component = (filePath: string, name: string): OmniNode => ({
      id: `component:${filePath}:${name}`,
      type: 'component',
      name,
      filePath,
      line: 2,
      column: 1,
      metadata: { props: [], hasState: false, isPage: false, jsxChildCount: 1 },
    })
    const graph: OmniGraph = {
      nodes: [
        component(serverPath, 'ServerPanel'),
        component(clientPath, 'ClientButton'),
      ],
      edges: [],
    }

    const issues = new RSCBoundaryDetector().detect(graph, root)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      messageKey: 'rsc_boundary_violation',
      messageParams: { component: 'ServerPanel', importPath: './ClientButton' },
    })
  })
})
