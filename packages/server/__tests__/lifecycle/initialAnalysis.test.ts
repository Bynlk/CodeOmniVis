import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { createOmniServer } from '../../src/index'

describe('ServerInstance initial analysis', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  })

  it('updates freshness when the owning CLI triggers the initial analysis', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-server-initial-'))
    roots.push(projectRoot)
    fs.mkdirSync(path.join(projectRoot, 'app'))
    fs.writeFileSync(path.join(projectRoot, 'app', 'page.tsx'), 'export default function Page() { return null }')
    const server = createOmniServer({ port: 0, host: '127.0.0.1', projectRoot })
    const analyzableServer = server as typeof server & { analyze: () => Promise<void> }

    await server.start()
    try {
      await expect(Promise.resolve().then(() => analyzableServer.analyze())).resolves.toBeUndefined()
      const response = await request(server.app).get('/api/status')
      expect(response.body.data.state).toBe('fresh')
      expect(response.body.data.lastAnalyzedAt).toEqual(expect.any(Number))
    } finally {
      await server.stop()
    }
  })
})
