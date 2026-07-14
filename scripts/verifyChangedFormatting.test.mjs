import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isFormattablePath } from './verifyChangedFormatting.mjs'

test('selects changed source, config, and workflow files', () => {
  assert.equal(isFormattablePath('packages/ui/src/App.tsx'), true)
  assert.equal(isFormattablePath('package.json'), true)
  assert.equal(isFormattablePath('.github/workflows/ci.yml'), true)
  assert.equal(isFormattablePath('docs/api/rest-api.md'), false)
})

test('skips generated output, caches, binary assets, and deleted-file placeholders', () => {
  assert.equal(isFormattablePath('packages/ui/dist/index.js'), false)
  assert.equal(isFormattablePath('coverage/coverage-final.json'), false)
  assert.equal(isFormattablePath('docs/assets/readme/hero.png'), false)
  assert.equal(isFormattablePath('.superpowers/private-plan.md'), false)
  assert.equal(isFormattablePath('pnpm-lock.yaml'), false)
  assert.equal(isFormattablePath(''), false)
})
