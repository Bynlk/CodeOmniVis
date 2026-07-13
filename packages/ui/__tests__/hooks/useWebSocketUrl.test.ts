import { describe, expect, it } from 'vitest'
import { getDefaultWebSocketUrl } from '../../src/hooks/useWebSocket'

describe('getDefaultWebSocketUrl', () => {
  it('uses ws for an HTTP page', () => {
    expect(getDefaultWebSocketUrl({ protocol: 'http:', host: '127.0.0.1:4321' }))
      .toBe('ws://127.0.0.1:4321/ws')
  })

  it('uses wss for an HTTPS page', () => {
    expect(getDefaultWebSocketUrl({ protocol: 'https:', host: 'architecture.example.com' }))
      .toBe('wss://architecture.example.com/ws')
  })
})
