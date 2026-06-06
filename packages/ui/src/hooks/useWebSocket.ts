/**
 * WebSocket 客户端 Hook
 *
 * 监听服务器 graph_updated 事件，自动刷新图数据。
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface WebSocketOptions {
  url?: string
  enabled?: boolean
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    url = `ws://${window.location.host}/ws`,
    enabled = true,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'graph_updated') {
            // 自动刷新图数据
            queryClient.invalidateQueries({ queryKey: ['graph'] })
            queryClient.invalidateQueries({ queryKey: ['graph-stats'] })
            queryClient.invalidateQueries({ queryKey: ['graph-errors'] })
          }
        } catch {
          // 忽略无法解析的消息
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        wsRef.current = null

        // 自动重连（3 秒后）
        if (enabled) {
          reconnectTimerRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        ws.close()
      }
    } catch {
      // WebSocket 连接失败，静默处理
    }
  }, [url, enabled, queryClient])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  }
}
