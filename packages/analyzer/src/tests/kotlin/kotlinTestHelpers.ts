import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseKotlinSource } from '../../parsers/kotlin/treeSitterInit'

export interface KotlinTestSource {
  source: string
  position(offset: number): { line: number; column: number }
  close(): void
}

export async function loadKotlinTestSource(
  projectRoot: string,
  filePath: string,
): Promise<KotlinTestSource> {
  const source = fs.readFileSync(path.resolve(projectRoot, filePath), 'utf8')
  const tree = await parseKotlinSource(source)
  return {
    source,
    position(offset) {
      const before = source.slice(0, offset)
      const lines = before.split('\n')
      return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }
    },
    close() {
      tree.delete()
    },
  }
}
