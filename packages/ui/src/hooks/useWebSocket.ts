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
import { getUiState } from '../store/uiStore'
import { invalidateAnalysisQueries } from './invalidateAnalysisQueries'

interface WebSocketQueryClient {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>
  setQueryData: (queryKey: readonly unknown[], data: unknown) => unknown
}

export async function handleWebSocketMessage(
  data: unknown,
  queryClient: WebSocketQueryClient,
): Promise<void> {
  if (isJsonObject(data) && data.type === 'graph_updated') {
    await invalidateAnalysisQueries(queryClient)
  } else if (isJsonObject(data) && data.type === 'status_changed' && isFreshnessStatus(data.payload)) {
    queryClient.setQueryData(STATUS_QUERY_KEY, data.payload)
  }
}

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

interface WebSocketLocation {
  protocol: string
  host: string
}

export function getDefaultWebSocketUrl(location: WebSocketLocation): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/ws`
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const enabled = options.enabled ?? true
  const url = options.url ?? getDefaultWebSocketUrl(window.location)

  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const controllerRef = useRef<WebSocketController | null>(null)
  // 断开→重连状态的防抖句柄:短暂抖动不立刻翻红,避免闪烁(design 风险项)。
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const clearDisconnectTimer = () => {
      if (disconnectTimerRef.current !== null) {
        clearTimeout(disconnectTimerRef.current)
        disconnectTimerRef.current = null
      }
    }

    const controller = new WebSocketController({
      createSocket: () => adaptWebSocket(new WebSocket(url)),
      onConnectedChange: (connected) => {
        setIsConnected(connected)
        const { setWsStatus } = getUiState()
        if (connected) {
          clearDisconnectTimer()
          setWsStatus('connected')
        } else {
          // 防抖:600ms 内若未恢复才标记为重连中。
          clearDisconnectTimer()
          disconnectTimerRef.current = setTimeout(() => {
            disconnectTimerRef.current = null
            getUiState().setWsStatus('reconnecting')
          }, 600)
        }
      },
      onMessage: (data) => {
        void handleWebSocketMessage(data, queryClient)
      },
    })
    controllerRef.current = controller
    controller.connect()

    return () => {
      clearDisconnectTimer()
      controller.dispose()
      controllerRef.current = null
    }
  }, [url, enabled, queryClient])

  return {
    isConnected,
  }
}
