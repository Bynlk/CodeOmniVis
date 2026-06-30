/**
 * WebSocket 客户端 Hook
 *
 * 监听服务器 graph_updated / status_changed 事件，自动刷新图数据。
 * 生命周期(连接 / 重连 / 销毁)委托给 WebSocketController,见 LEAK-04/F10:
 * 卸载后不再重连,也不会在已卸载组件上 setState。
 */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isJsonObject, isFreshnessStatus } from '@codeomnivis/shared'
import { STATUS_QUERY_KEY } from './useStatus'
import { WebSocketController, type MinimalSocket } from './websocketController'

/**
 * 把浏览器原生 WebSocket 适配成控制器所需的最小接口。
 * 原生事件回调签名带 Event 参数,这里收敛为无参回调,避免结构不兼容。
 */
function adaptWebSocket(socket: WebSocket): MinimalSocket {
  const adapter: MinimalSocket = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    close: () => socket.close(),
  }
  socket.onopen = () => adapter.onopen?.()
  socket.onmessage = (event) => adapter.onmessage?.({ data: event.data })
  socket.onclose = () => adapter.onclose?.()
  socket.onerror = (event) => adapter.onerror?.(event)
  return adapter
}

interface WebSocketOptions {
  url?: string
  enabled?: boolean
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    url = `ws://${window.location.host}/ws`,
    enabled = true,
  } = options

  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const controllerRef = useRef<WebSocketController | null>(null)

  useEffect(() => {
    if (!enabled) return

    const controller = new WebSocketController({
      createSocket: () => adaptWebSocket(new WebSocket(url)),
      onConnectedChange: (connected) => setIsConnected(connected),
      onMessage: (data) => {
        if (isJsonObject(data) && data.type === 'graph_updated') {
          queryClient.invalidateQueries({ queryKey: ['graph'] })
          queryClient.invalidateQueries({ queryKey: ['graph-stats'] })
          queryClient.invalidateQueries({ queryKey: ['graph-errors'] })
        } else if (isJsonObject(data) && data.type === 'status_changed') {
          if (isFreshnessStatus(data.payload)) {
            queryClient.setQueryData(STATUS_QUERY_KEY, data.payload)
          }
        }
      },
    })
    controllerRef.current = controller
    controller.connect()

    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [url, enabled, queryClient])

  return {
    isConnected,
  }
}
