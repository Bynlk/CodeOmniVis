import type { TestAdapter } from './types'
import { VitestJestAdapter } from './typescript/vitestJestAdapter'

export function createDefaultTestAdapters(): TestAdapter[] {
  return [VitestJestAdapter]
}
