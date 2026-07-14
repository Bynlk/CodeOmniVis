import type { TestAdapter } from './types'
import { VitestJestAdapter } from './typescript/vitestJestAdapter'
import { PlaywrightAdapter } from './typescript/playwrightAdapter'
import { CypressAdapter } from './typescript/cypressAdapter'

export function createDefaultTestAdapters(): TestAdapter[] {
  return [PlaywrightAdapter, CypressAdapter, VitestJestAdapter]
}
