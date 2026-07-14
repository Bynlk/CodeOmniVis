import type { TestAdapter } from './types'
import { VitestJestAdapter } from './typescript/vitestJestAdapter'
import { PlaywrightAdapter } from './typescript/playwrightAdapter'
import { CypressAdapter } from './typescript/cypressAdapter'
import { JunitAdapter } from './kotlin/junitAdapter'
import { KotestAdapter } from './kotlin/kotestAdapter'

export function createDefaultTestAdapters(): TestAdapter[] {
  return [PlaywrightAdapter, CypressAdapter, VitestJestAdapter, JunitAdapter, KotestAdapter]
}
