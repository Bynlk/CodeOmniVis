import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterAll, describe, expect, it } from 'vitest'
import { analyzeProject } from '../../src/graph/analyzeProject'

const FILE_COUNT = 1_000
const MAX_ANALYSIS_MS = 60_000

describe('test discovery performance', () => {
  const temporaryRoots: string[] = []

  afterAll(() => {
    for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true })
  })

  it('keeps a 1,000-file project below the documented full-analysis target', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-1000-files-'))
    temporaryRoots.push(projectRoot)
    const testRoot = path.join(projectRoot, 'tests')
    fs.mkdirSync(testRoot, { recursive: true })
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'performance-fixture',
        private: true,
        devDependencies: { vitest: '*' },
      }),
    )
    for (let index = 0; index < FILE_COUNT; index += 1) {
      fs.writeFileSync(
        path.join(testRoot, `case-${index}.test.ts`),
        `import { it } from 'vitest'\nit('case ${index}', () => {})\n`,
      )
    }

    const startedAt = performance.now()
    const result = await analyzeProject({ projectRoot })
    const durationMs = performance.now() - startedAt
    const cases = result.snapshot.graph.nodes.filter((node) => node.type === 'test_case')

    expect(result.snapshot.provenance.filesScanned).toBe(FILE_COUNT)
    expect(cases).toHaveLength(FILE_COUNT)
    expect(durationMs).toBeLessThan(MAX_ANALYSIS_MS)
  }, 70_000)
})
