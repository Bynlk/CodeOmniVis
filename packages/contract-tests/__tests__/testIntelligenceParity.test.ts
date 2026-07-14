import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { analyzeProject, OmniDatabase, projectTestView } from '@codeomnivis/analyzer'
import { executeMcpTool, MCP_TOOL_NAMES } from '@codeomnivis/mcp'
import { createGraphRouter, createTestsRouter } from '@codeomnivis/server'
import { getDbPath } from '@codeomnivis/shared/node'

const TEST_NODE_TYPES = new Set(['test_suite', 'test_case', 'test_fixture'])
const TEST_EDGE_TYPES = new Set(['tests', 'covers', 'uses_fixture'])

function ids(values: Array<{ id: string }>): string[] {
  return values.map((value) => value.id).sort()
}

function testNodeIds(graph: { nodes: Array<{ id: string; type: string }> }): string[] {
  return ids(graph.nodes.filter((node) => TEST_NODE_TYPES.has(node.type)))
}

function testEdgeIds(graph: { edges: Array<{ id: string; type: string }> }): string[] {
  return ids(graph.edges.filter((edge) => TEST_EDGE_TYPES.has(edge.type)))
}

function toolBody(result: ReturnType<typeof executeMcpTool>) {
  const content = result.content[0]
  if (content.type !== 'text') throw new Error('Expected MCP text content')
  return JSON.parse(content.text)
}

describe('cross-language test intelligence parity', () => {
  const temporaryRoots: string[] = []

  afterAll(() => {
    for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true })
  })

  it('projects identical TypeScript and Kotlin test IDs through analyzer, CLI, REST and MCP', async () => {
    const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url))
    const fixture = fileURLToPath(new URL('../fixtures/test-intelligence', import.meta.url))
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-parity-'))
    temporaryRoots.push(projectRoot)
    fs.cpSync(fixture, projectRoot, { recursive: true })
    const dbPath = getDbPath(projectRoot)

    const direct = await analyzeProject({ projectRoot, dbPath })
    expect(
      direct.snapshot.parseErrors.filter(
        (error) => error.message.includes('discovery failed') || error.message.includes('ENOENT'),
      ),
    ).toEqual([])
    const directView = projectTestView(direct.snapshot.graph)
    const discoveredFrameworks = [
      ...new Set(directView.cases.map((node) => node.metadata.framework)),
    ].sort()
    expect(discoveredFrameworks).toEqual(
      expect.arrayContaining([
        'vitest',
        'jest',
        'playwright',
        'cypress',
        'junit4',
        'junit5',
        'kotest',
      ]),
    )

    const cli = spawnSync(
      process.execPath,
      [
        path.join(workspaceRoot, 'packages/cli/dist/index.js'),
        'analyze',
        '--project',
        projectRoot,
        '--json',
      ],
      { cwd: workspaceRoot, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } },
    )
    expect(cli.status, cli.stderr).toBe(0)
    const cliEnvelope = JSON.parse(cli.stdout)

    const db = new OmniDatabase(dbPath)
    await db.ready()
    const app = express()
    app.use(
      '/api/graph',
      createGraphRouter(db, undefined, () => projectRoot),
    )
    app.use('/api/tests', createTestsRouter(db))
    const [restGraph, restTests] = await Promise.all([
      request(app).get('/api/graph'),
      request(app).get('/api/tests'),
    ])
    const mcp = toolBody(executeMcpTool(db, MCP_TOOL_NAMES.getTestCoverage, {}))

    expect(
      cliEnvelope.data.parseErrors.filter(
        (error) => error.message.includes('discovery failed') || error.message.includes('ENOENT'),
      ),
    ).toEqual([])
    expect(testNodeIds(cliEnvelope.data.graph)).toEqual(testNodeIds(direct.snapshot.graph))
    expect(testEdgeIds(cliEnvelope.data.graph)).toEqual(testEdgeIds(direct.snapshot.graph))
    const digest = direct.snapshot.snapshotDigest
    expect(cliEnvelope.meta.snapshotDigest).toBe(digest)
    expect(restGraph.body.meta.snapshotDigest).toBe(digest)
    expect(restTests.body.meta.snapshotDigest).toBe(digest)
    expect(mcp.snapshot.snapshotDigest).toBe(digest)
    expect(testNodeIds(restGraph.body.data)).toEqual(testNodeIds(direct.snapshot.graph))
    expect(testNodeIds(mcp.snapshot.graph)).toEqual(testNodeIds(direct.snapshot.graph))
    expect(testEdgeIds(restGraph.body.data)).toEqual(testEdgeIds(direct.snapshot.graph))
    expect(testEdgeIds(mcp.snapshot.graph)).toEqual(testEdgeIds(direct.snapshot.graph))
    expect(ids(restTests.body.data.cases)).toEqual(ids(directView.cases))
    expect(ids(restTests.body.data.coverage)).toEqual(ids(directView.coverage))
    expect(ids(mcp.cases)).toEqual(ids(directView.cases))
    expect(ids(mcp.coverage)).toEqual(ids(directView.coverage))
    db.close()
  })
})
