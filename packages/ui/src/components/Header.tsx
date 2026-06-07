import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LangToggle } from './Header/LangToggle'

interface HeaderProps {
  query?: string
  onQueryChange?: (query: string) => void
}

export default function Header({ query, onQueryChange }: HeaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // 调用 /api/analyze 触发重新分析
      const res = await fetch('/api/analyze', { method: 'POST' })
      if (!res.ok) {
        console.error('Refresh failed:', res.status, res.statusText)
      }
      // 让 React Query 重新拉取图数据
      await queryClient.invalidateQueries({ queryKey: ['graph'] })
    } catch (err) {
      console.error('Refresh error:', err)
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

          {/* 语言切换 */}
          <LangToggle />

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
        </div>
      </div>
    </header>
  )
}
