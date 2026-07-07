import { useTranslation } from 'react-i18next'
import { useUiStore, type WsStatus } from '../../store/uiStore'

/** 连接状态 → 颜色点 class(绿/灰/黄)。测试锁定这些类名与状态映射。 */
const DOT_CLASS: Record<WsStatus, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-slate-400',
  reconnecting: 'bg-yellow-500 animate-pulse',
}

const LABEL_KEY: Record<WsStatus, string> = {
  connected: 'ws.connected',
  connecting: 'ws.connecting',
  reconnecting: 'ws.reconnecting',
}

/**
 * WebSocket 连接状态指示灯(feature-011 重写)。
 * 消费 uiStore.wsStatus(由 useWebSocket 写入),在顶栏显示颜色点 + 文案。
 */
export function WsStatusIndicator() {
  const { t } = useTranslation()
  const wsStatus = useUiStore((s) => s.wsStatus)
  const label = t(LABEL_KEY[wsStatus])

  return (
    <div
      className="flex items-center gap-1.5 text-ds-xs text-content-muted"
      role="status"
      aria-label={label}
      title={label}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${DOT_CLASS[wsStatus]}`} aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
    </div>
  )
}
