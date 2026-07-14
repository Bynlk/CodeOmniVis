import assert from 'node:assert/strict'
import test from 'node:test'
import { waitForPublishedVersion } from './registryVisibility.mjs'

test('retries transient registry 404 responses until the published version is visible', async () => {
  let attempts = 0
  const delays = []

  const published = await waitForPublishedVersion({
    version: '0.1.0',
    maxAttempts: 3,
    lookup: () => {
      attempts += 1
      if (attempts < 3) throw new Error('npm error code E404\nNo match found for version 0.1.0')
      return '0.1.0'
    },
    delay: async (milliseconds) => {
      delays.push(milliseconds)
    },
  })

  assert.equal(published, '0.1.0')
  assert.equal(attempts, 3)
  assert.deepEqual(delays, [2_000, 4_000])
})

test('does not retry non-transient registry failures', async () => {
  let attempts = 0

  await assert.rejects(
    waitForPublishedVersion({
      version: '0.1.0',
      maxAttempts: 3,
      lookup: () => {
        attempts += 1
        throw new Error('npm error code E401\nAuthentication failed')
      },
      delay: async () => {},
    }),
    /E401/u,
  )

  assert.equal(attempts, 1)
})

test('returns the final transient failure after the retry budget is exhausted', async () => {
  let attempts = 0

  await assert.rejects(
    waitForPublishedVersion({
      version: '0.1.0',
      maxAttempts: 2,
      lookup: () => {
        attempts += 1
        throw new Error('npm error code E404\nNo match found for version 0.1.0')
      },
      delay: async () => {},
    }),
    /No match found/u,
  )

  assert.equal(attempts, 2)
})
