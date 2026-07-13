import { describe, expect, it, vi } from 'vitest'

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn((options: unknown) => options),
}))

vi.mock('@tanstack/react-query', () => ({ useQuery: useQueryMock }))

import { useStatus } from '../../src/hooks/useStatus'

describe('useStatus query options', () => {
  it('marks fallback data stale so the real status is requested immediately', () => {
    const options = useStatus() as unknown as { initialDataUpdatedAt?: number }

    expect(options.initialDataUpdatedAt).toBe(0)
  })
})
