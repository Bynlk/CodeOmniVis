/**
 * LEAK-04 / F10 回归测试 —— WebSocket 生命周期控制器。
 *
 * 缺陷:卸载后 onclose 仍触发自动重连,创建新 socket 并在已卸载组件上 setState。
 * 这里用注入式假 socket + 注入式重连调度,在 node 环境下锁定:
 *   1. dispose() 后挂起的重连被取消,不再创建新 socket。
 *   2. dispose() 之后到达的 onclose 不触发重连、不回调连接态。
 *   3. 仅"非主动关闭"才重连(主动 dispose 不重连)。
 *   4. 解析失败的消息被忽略,合法消息回调 onMessage。
 */

import { describe, it, expect, vi } from 'vitest'
import { WebSocketController, type MinimalSocket } from '../../src/hooks/websocketController'

function makeFakeSocket(): MinimalSocket {
  return {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: vi.fn(),
  }
}

describe('WebSocketController 生命周期 (LEAK-04/F10)', () => {
  it('dispose() 取消挂起重连且不再创建新 socket', () => {
    const sockets: MinimalSocket[] = []
    const pending: Array<() => void> = []
    let cancelled = false

    const controller = new WebSocketController({
      createSocket: () => {
        const s = makeFakeSocket()
        sockets.push(s)
        return s
      },
      onMessage: () => {},
      scheduleReconnect: (cb) => {
        pending.push(cb)
        return () => {
          cancelled = true
          pending.length = 0
        }
      },
    })

    controller.connect()
    expect(sockets.length).toBe(1)

    // 模拟服务端断开 → 安排了一次重连
    sockets[0].onclose?.()
    expect(pending.length).toBe(1)

    // 组件卸载:取消挂起重连
    controller.dispose()
    expect(cancelled).toBe(true)
    expect(pending.length).toBe(0)

    // dispose 后 connect() 应直接 no-op
    controller.connect()
    expect(sockets.length).toBe(1)
  })

  it('dispose() 后到达的 onclose 不重连、不回调连接态', () => {
    const sockets: MinimalSocket[] = []
    const connectedChanges: boolean[] = []
    let scheduled = false

    const controller = new WebSocketController({
      createSocket: () => {
        const s = makeFakeSocket()
        sockets.push(s)
        return s
      },
      onMessage: () => {},
      onConnectedChange: (c) => connectedChanges.push(c),
      scheduleReconnect: () => {
        scheduled = true
        return () => {}
      },
    })

    controller.connect()
    sockets[0].onopen?.()
    expect(connectedChanges).toEqual([true])

    controller.dispose()
    // dispose 自身回调一次 false
    expect(connectedChanges).toEqual([true, false])

    // 卸载后底层 socket 才真正触发 onclose(异步)
    sockets[0].onclose?.()
    expect(connectedChanges).toEqual([true, false])
    expect(scheduled).toBe(false)
    expect(sockets.length).toBe(1)
  })

  it('非主动关闭时自动重连创建新 socket', () => {
    const sockets: MinimalSocket[] = []
    const pending: Array<() => void> = []

    const controller = new WebSocketController({
      createSocket: () => {
        const s = makeFakeSocket()
        sockets.push(s)
        return s
      },
      onMessage: () => {},
      scheduleReconnect: (cb) => {
        pending.push(cb)
        return () => { pending.length = 0 }
      },
    })

    controller.connect()
    sockets[0].onclose?.()
    // 触发排定的重连
    pending[0]?.()
    expect(sockets.length).toBe(2)

    controller.dispose()
  })

  it('忽略无法解析的消息,合法消息回调 onMessage', () => {
    const sockets: MinimalSocket[] = []
    const received: unknown[] = []
    const controller = new WebSocketController({
      createSocket: () => { const s = makeFakeSocket(); sockets.push(s); return s },
      onMessage: (d) => received.push(d),
      scheduleReconnect: () => () => {},
    })
    controller.connect()
    sockets[0].onmessage?.({ data: 'not json{' })
    sockets[0].onmessage?.({ data: JSON.stringify({ type: 'graph_updated' }) })
    expect(received.length).toBe(1)
    controller.dispose()
  })
})
