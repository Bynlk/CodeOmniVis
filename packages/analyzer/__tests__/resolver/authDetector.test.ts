import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { OmniGraph, OmniNode } from '@codeomnivis/shared'
import { AuthDetector } from '../../src/resolver/authDetector'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('AuthDetector', () => {
  it('reports method handlers without duplicating the aggregate API route', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-auth-detector-'))
    roots.push(projectRoot)
    const filePath = 'app/api/booking/route.ts'
    const absolute = path.join(projectRoot, filePath)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, [
      'export function GET() { return Response.json([]) }',
      'export function POST() { return Response.json({}) }',
    ].join('\n'))

    const route: OmniNode = {
      id: `api_route:${filePath}:/api/booking`,
      type: 'api_route',
      name: '/api/booking',
      filePath,
      line: 1,
      column: 1,
      metadata: { method: 'GET,POST', route: '/api/booking', isNextApiRoute: true },
    }
    const handler = (method: string, line: number): OmniNode => ({
      id: `handler:${filePath}:${method}`,
      type: 'handler',
      name: `${method} handler`,
      filePath,
      line,
      column: 1,
      metadata: { functionName: method, routeId: route.id },
    })
    const graph: OmniGraph = { nodes: [route, handler('GET', 1), handler('POST', 2)], edges: [] }

    const issues = new AuthDetector().detect(graph, projectRoot)

    expect(issues.map(issue => issue.relatedNodeIds[0]).sort()).toEqual([
      `handler:${filePath}:GET`,
      `handler:${filePath}:POST`,
    ])
    expect(issues.map(issue => issue.description).sort()).toEqual([
      'API route "GET /api/booking" has no authentication guard',
      'API route "POST /api/booking" has no authentication guard',
    ])
    expect(issues.map(issue => [issue.messageKey, issue.messageParams])).toEqual([
      ['unguarded_route', { route: 'GET /api/booking' }],
      ['unguarded_route', { route: 'POST /api/booking' }],
    ])
  })

  it('checks authentication inside each handler instead of trusting the whole file', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-auth-scope-'))
    roots.push(projectRoot)
    const filePath = 'app/api/account/route.ts'
    const absolute = path.join(projectRoot, filePath)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, [
      "import { auth } from '@/auth'",
      'export async function GET() { await auth(); return Response.json({}) }',
      'export function POST() { return Response.json({}) }',
    ].join('\n'))

    const route: OmniNode = {
      id: `api_route:${filePath}:/api/account`,
      type: 'api_route',
      name: '/api/account',
      filePath,
      line: 2,
      column: 1,
      metadata: { method: 'GET,POST', route: '/api/account', isNextApiRoute: true },
    }
    const handler = (method: string, line: number): OmniNode => ({
      id: `handler:${filePath}:${method}`,
      type: 'handler',
      name: `${method} handler`,
      filePath,
      line,
      column: 1,
      metadata: { functionName: method, routeId: route.id },
    })

    const issues = new AuthDetector().detect({
      nodes: [route, handler('GET', 2), handler('POST', 3)],
      edges: [],
    }, projectRoot)

    expect(issues.map(issue => issue.relatedNodeIds[0])).toEqual([
      `handler:${filePath}:POST`,
    ])
  })
})
