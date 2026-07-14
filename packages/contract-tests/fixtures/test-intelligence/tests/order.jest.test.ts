import { describe, expect, test } from '@jest/globals'
import { OrderCard } from '../components/OrderCard'

describe('OrderCard with Jest', () => {
  test('references the order component', () => {
    expect(OrderCard).toBeDefined()
  })
})
