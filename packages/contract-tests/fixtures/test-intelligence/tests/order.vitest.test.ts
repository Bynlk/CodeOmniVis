import { beforeEach, describe, expect, it } from 'vitest'
import { OrderCard } from '../components/OrderCard'

describe('OrderCard with Vitest', () => {
  beforeEach(() => {})

  it('references the order component', () => {
    expect(OrderCard).toBeDefined()
  })
})
