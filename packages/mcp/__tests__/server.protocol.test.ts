import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import type { ProjectSnapshot } from '@codeomnivis/shared'
import { clearDbCache, getDbPath } from '@codeomnivis/shared/node'
import { createMcpServer, PUBLIC_TOOL_NAMES } from '../src/server'

function snapshot(root: string): ProjectSnapshot {
  const model = {
    id: 'db_model:schema.ts:Order', type: 'db_model' as const, name: 'Order',
    filePath: 'schema.ts', line: 1, column: 1,
    metadata: { tableName: 'orders', fieldCount: 0, fields: [] },
  }
  return {
    schemaVersion: 1,
    snapshotId: 'protocol-snapshot',
    snapshotDigest: 'a'.repeat(64),
    project: {
      root,
      fingerprint: 'protocol-fixture',
      meta: {
        root, frontendFramework: 'unknown', backendFramework: 'unknown', databaseType: 'unknown',
        monorepoType: 'none', frontendDirs: [], backendDirs: [], trpcRouterPaths: [],
        tsrpcServicePaths: [], tsrpcApiDirs: [], tsrpcProtocolDirs: [], prismaSchemaPath: null,
        typeormEntityDirs: [], tsConfigPath: null, buildFile: null, packages: [],
      },
    },
    graph: { nodes: [model], edges: [] },
    issues: [],
    parseErrors: [],
    stats: {
      filesScanned: 1, nodeCount: 1, edgeCount: 0, issueCount: 0, parseErrorCount: 0,
      nodeTypeCounts: { db_model: 1 }, edgeTypeCounts: {},
      issueSeverityCounts: { critical: 0, warning: 0, info: 0 },
      parseErrorSeverityCounts: { error: 0, warning: 0, info: 0 },
    },
    freshness: { state: 'fresh', lastAnalyzedAt: 1, pendingChanges: 0 },
    provenance: { generatedAt: 1, analyzerVersion: 'test', filesScanned: 1, sourceDigest: 'source' },
  }
}

function textBody(result: Awaited<ReturnType<Client['callTool']>>) {
  const content: unknown = 'content' in result ? result.content : undefined
  if (!Array.isArray(content)) throw new Error('Expected tool content')
  const first: unknown = content[0]
  if (!first || typeof first !== 'object' || !('type' in first) || first.type !== 'text'
    || !('text' in first) || typeof first.text !== 'string') {
    throw new Error('Expected text tool response')
  }
  return JSON.parse(first.text)
}

describe('in-process MCP protocol', () => {
  let projectRoot: string
  let client: Client
  let runtime: ReturnType<typeof createMcpServer>

  beforeEach(async () => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-mcp-protocol-'))
    const database = new OmniDatabase(getDbPath(projectRoot))
    await database.ready()
    database.replaceSnapshot(snapshot(projectRoot))
    database.close()

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    runtime = createMcpServer({ projectRoot })
    client = new Client({ name: 'protocol-test', version: '1.0.0' })
    await runtime.server.connect(serverTransport)
    await client.connect(clientTransport)
  })

  afterEach(async () => {
    await client.close().catch(() => {})
    await runtime.close().catch(() => {})
    clearDbCache(projectRoot)
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('lists and executes every public tool against one cached snapshot', async () => {
    const tools = await client.listTools()
    expect(tools.tools.map(tool => tool.name)).toEqual([...PUBLIC_TOOL_NAMES])

    const models = textBody(await client.callTool({ name: 'list_db_models', arguments: {} }))
    expect(models.models[0].name).toBe('Order')
    expect(models.snapshot.snapshotDigest).toBe('a'.repeat(64))

    const coverage = textBody(await client.callTool({ name: 'get_test_coverage', arguments: {} }))
    expect(coverage.summary.cases).toBe(0)
    expect(coverage.snapshot.snapshotId).toBe('protocol-snapshot')

    const unknown = textBody(await client.callTool({ name: 'unknown_tool', arguments: {} }))
    expect(unknown.error).toContain('Unknown tool')
    await runtime.close()
    await runtime.close()
  })
})
