import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { analyzeProject, OmniDatabase } from '@codeomnivis/analyzer'
import { executeMcpTool, MCP_TOOL_NAMES } from '@codeomnivis/mcp'
import { createGraphRouter } from '@codeomnivis/server'
import { getDbPath } from '@codeomnivis/shared/node'

function ids(values: Array<{ id: string }>): string[] {
  return values.map(value => value.id).sort()
}

function toolBody(result: ReturnType<typeof executeMcpTool>) {
  const content = result.content[0]
  if (content.type !== 'text') throw new Error('Expected MCP text content')
  return JSON.parse(content.text)
}

describe('ProjectSnapshot parity', () => {
  const temporaryRoots: string[] = []

  afterAll(() => {
    for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true })
  })

  it('keeps analyzer, CLI, REST and MCP on the same committed snapshot digest', async () => {
    const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url))
    const fixture = fileURLToPath(new URL('../fixtures/parity-project', import.meta.url))
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-parity-'))
    temporaryRoots.push(projectRoot)
    fs.cpSync(fixture, projectRoot, { recursive: true })
    const dbPath = getDbPath(projectRoot)

    const direct = await analyzeProject({ projectRoot, dbPath })
    const cli = spawnSync(
      process.execPath,
      [path.join(workspaceRoot, 'packages/cli/dist/index.js'), 'analyze', '--project', projectRoot, '--json'],
      { cwd: workspaceRoot, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } },
    )
    expect(cli.status, cli.stderr).toBe(0)
    const cliEnvelope = JSON.parse(cli.stdout)

    const db = new OmniDatabase(dbPath)
    await db.ready()
    const app = express()
    app.use('/api/graph', createGraphRouter(db, undefined, () => projectRoot))
    const [restGraph, restIssues] = await Promise.all([
      request(app).get('/api/graph'),
      request(app).get('/api/graph/issues'),
    ])
    const mcp = toolBody(executeMcpTool(db, MCP_TOOL_NAMES.listDbModels, {}))

    const digest = direct.snapshot.snapshotDigest
    expect(cliEnvelope.meta.snapshotDigest).toBe(digest)
    expect(restGraph.body.meta.snapshotDigest).toBe(digest)
    expect(mcp.snapshot.snapshotDigest).toBe(digest)
    expect(ids(cliEnvelope.data.graph.nodes)).toEqual(ids(direct.snapshot.graph.nodes))
    expect(ids(restGraph.body.data.nodes)).toEqual(ids(direct.snapshot.graph.nodes))
    expect(ids(mcp.snapshot.graph.nodes)).toEqual(ids(direct.snapshot.graph.nodes))
    expect(ids(cliEnvelope.data.graph.edges)).toEqual(ids(direct.snapshot.graph.edges))
    expect(ids(restGraph.body.data.edges)).toEqual(ids(direct.snapshot.graph.edges))
    expect(ids(mcp.snapshot.graph.edges)).toEqual(ids(direct.snapshot.graph.edges))
    expect(ids(restIssues.body.data)).toEqual(ids(direct.snapshot.issues))
    db.close()
  })
})
