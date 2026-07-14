const TRANSIENT_NOT_FOUND = /(?:\bE404\b|No match found for version)/u

function sleep(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

export async function waitForPublishedVersion({ version, lookup, maxAttempts = 6, delay = sleep }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return lookup()
    } catch (error) {
      const transient = error instanceof Error && TRANSIENT_NOT_FOUND.test(error.message)
      if (!transient || attempt === maxAttempts) throw error
      await delay(Math.min(2_000 * 2 ** (attempt - 1), 15_000))
    }
  }

  throw new Error('Registry visibility retry loop ended unexpectedly for version ' + version)
}
