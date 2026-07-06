import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LangToggle } from './Header/LangToggle'
import { FreshnessBadge } from './Header/FreshnessBadge'
import { WsStatusIndicator } from './Header/WsStatusIndicator'
import { useStatus, STATUS_QUERY_KEY } from '../hooks/useStatus'
import { postAnalyze, ApiError } from '../services'

interface HeaderProps {
  query?: string
  onQueryChange?: (query: string) => void
  onOpenSettings?: () => void
}

export default function Header({ query, onQueryChange, onOpenSettings }: HeaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { data: status } = useStatus()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      // 调用 /api/analyze 触发重新分析（经服务层）
      await postAnalyze()
      // 让 React Query 重新拉取图数据与新鲜度状态
      await queryClient.invalidateQueries({ queryKey: ['graph'] })
      await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
    } catch (err) {
      const errorMsg = err instanceof ApiError
        ? `Refresh failed: ${err.status} ${err.statusText}`
        : err instanceof Error ? err.message : 'Unknown error'
      setRefreshError(errorMsg)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold text-white">
            <span className="text-primary-400">Code</span>Omni<span className="text-primary-400">Vis</span>
          </h1>
          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
            {t('header.subtitle')}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {/* 搜索框 */}
          {onQueryChange && (
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query || ''}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={t('header.searchPlaceholder', { shortcut: '⌘K' })}
                className="w-64 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 transition-colors"
                aria-label={t('header.searchNodes')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                ⌘K
              </span>
            </div>
          )}

          {/* WebSocket 连接状态（feature-006） */}
          <WsStatusIndicator />

          {/* 数据新鲜度 */}
          <FreshnessBadge status={status} />

          {/* 语言切换 */}
          <LangToggle />

          {/* 设置抽屉入口 */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="rounded px-2 py-1 text-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              aria-label={t('settings.open')}
              title={t('settings.title')}
            >
              ⚙
            </button>
          )}

          {/* 刷新按钮 */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
            aria-label={t('header.refreshGraph')}
          >
            {isRefreshing ? (
              <span className="animate-spin">⟳</span>
            ) : '↺'}
            <span className="ml-1 text-xs">
              {isRefreshing ? t('header.refreshing') : t('header.refresh')}
            </span>
          </button>
          {refreshError && (
            <span role="alert" className="ml-2 text-xs text-red-600">
              {refreshError}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
