import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { OmniNode } from '@codeomnivis/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { ServiceLinkResolver } from '../../src/resolver/serviceLinkResolver'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('ServiceLinkResolver', () => {
  it('links only named and default imports called inside the selected handler', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-service-resolver-'))
    temporaryRoots.push(projectRoot)
    const routeFile = path.join(projectRoot, 'app', 'api', 'booking', 'route.ts')
    const serviceFile = path.join(projectRoot, 'server', 'services', 'bookingService.ts')
    fs.mkdirSync(path.dirname(routeFile), { recursive: true })
    fs.mkdirSync(path.dirname(serviceFile), { recursive: true })
    fs.writeFileSync(routeFile, [
      "import defaultBookingService, { createBooking as create, unusedBooking } from '../../../server/services/bookingService'",
      'export function GET() { return create() }',
      'export function POST() { return defaultBookingService() }',
    ].join('\n'))
    fs.writeFileSync(serviceFile, [
      'export default function defaultBookingService() { return [] }',
      'export function createBooking() { return {} }',
      'export function unusedBooking() { return null }',
    ].join('\n'))

    const handler = (functionName: string, line: number): OmniNode => ({
      id: `handler:app/api/booking/route.ts:${functionName}`,
      type: 'handler',
      name: `${functionName} handler`,
      filePath: 'app/api/booking/route.ts',
      line,
      column: 1,
      metadata: { functionName, routeId: null },
    })
    const resolver = new ServiceLinkResolver(projectRoot)

    const getResult = resolver.resolve(handler('GET', 2), [])
    const postResult = resolver.resolve(handler('POST', 3), [])

    expect(getResult.edges.map(edge => edge.target)).toEqual([
      'service:server/services/bookingService.ts:createBooking',
    ])
    expect(postResult.edges.map(edge => edge.target)).toEqual([
      'service:server/services/bookingService.ts:defaultBookingService',
    ])
    expect([...getResult.nodes, ...postResult.nodes].some(node => node.name === 'unusedBooking'))
      .toBe(false)
  })
})
