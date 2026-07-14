import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeProject } from '../../src/graph/analyzeProject'

describe('test discovery pipeline', () => {
  it('commits discovered tests and coverage edges in the ProjectSnapshot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-test-discovery-'))
    try {
      fs.mkdirSync(path.join(root, 'src'))
      fs.mkdirSync(path.join(root, 'tests'))
      fs.writeFileSync(
        path.join(root, 'src', 'Checkout.tsx'),
        'export function Checkout() { return <main /> }',
      )
      fs.writeFileSync(
        path.join(root, 'tests', 'checkout.test.ts'),
        "import { describe, it } from 'vitest'\nimport { Checkout } from '../src/Checkout'\ndescribe('checkout', () => it('renders', () => Checkout()))",
      )

      const result = await analyzeProject({ projectRoot: root })

      expect(result.snapshot.graph.nodes.some((node) => node.type === 'test_case')).toBe(true)
      expect(result.snapshot.graph.edges.some((edge) => edge.type === 'covers')).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
