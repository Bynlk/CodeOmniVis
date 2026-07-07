import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LangToggle } from './Header/LangToggle'
import { FreshnessBadge } from './Header/FreshnessBadge'
import { WsStatusIndicator } from './Header/WsStatusIndicator'
import { useStatus, STATUS_QUERY_KEY } from '../hooks/useStatus'
import { postAnalyze, ApiError } from '../services'
import { useUiStore } from '../store/uiStore'

interface HeaderProps {
  query?: string
  onQueryChange?: (query: string) => void
  onOpenSettings?: () => void
}

/**
 * feature-011 顶部导航栏(从 0 重写)。
 * 左:菜单(移动) + 品牌。右:统一搜索入口 + WS 状态 + 新鲜度 + 语言 + 设置 + 刷新。
 * 采用语义表面色 token(surface-raised / border-subtle / content-*)与全站一致。
 */
export default function Header({ query, onQueryChange, onOpenSettings }: HeaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { data: status } = useStatus()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const toggleMobileDrawer = useUiStore((s) => s.toggleMobileDrawer)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      await postAnalyze()
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-ds-3 border-b border-border-subtle bg-surface-raised px-ds-4 sm:px-ds-5">
      {/* 左区:移动菜单 + 品牌 */}
      <div className="flex min-w-0 items-center gap-ds-3">
        <button
          onClick={() => toggleMobileDrawer(true)}
          className="flex h-9 w-9 items-center justify-center rounded-ds-md text-content-secondary transition-colors hover:bg-surface-hover hover:text-content md:hidden"
          aria-label={t('menu.open')}
          title={t('menu.open')}
        >
          <span aria-hidden="true" className="text-lg">☰</span>
        </button>

        <div className="flex min-w-0 items-center gap-ds-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-md bg-gradient-to-br from-primary-400 to-primary-600 text-ds-sm font-bold text-white shadow-ds-card"
          >
            ⬡
          </span>
          <h1 className="truncate text-ds-lg font-bold tracking-tight text-content">
            <span className="text-primary-400">Code</span>Omni<span className="text-primary-400">Vis</span>
          </h1>
          <span className="hidden rounded-ds-sm bg-surface-hover px-ds-2 py-0.5 text-ds-xs text-content-muted sm:inline">
            {t('header.subtitle')}
          </span>
        </div>
      </div>

      {/* 右区:搜索 + 状态 + 工具 */}
      <div className="flex items-center gap-ds-2 sm:gap-ds-3">
        {onQueryChange && (
          <div className="relative">
            <span className="pointer-events-none absolute left-ds-3 top-1/2 -translate-y-1/2 text-content-muted" aria-hidden="true">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query || ''}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t('header.searchPlaceholder', { shortcut: '⌘K' })}
              className="w-36 rounded-ds-md border border-border-subtle bg-surface py-2 pl-9 pr-12 text-ds-sm text-content placeholder-content-muted transition-colors focus:border-primary-500 focus:outline-none sm:w-52 md:w-72"
              aria-label={t('header.searchNodes')}
            />
            <kbd className="pointer-events-none absolute right-ds-2 top-1/2 hidden -translate-y-1/2 rounded-ds-sm border border-border-subtle bg-surface-hover px-1.5 py-0.5 text-ds-xs text-content-muted sm:inline">
              ⌘K
            </kbd>
          </div>
        )}

        <div className="hidden items-center gap-ds-3 sm:flex">
          <WsStatusIndicator />
          <FreshnessBadge status={status} />
        </div>

        <div className="h-6 w-px bg-border-subtle" aria-hidden="true" />

        <LangToggle />

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-ds-md text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('settings.open')}
            title={t('settings.title')}
          >
            <span aria-hidden="true" className="text-lg">⚙</span>
          </button>
        )}

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-ds-md bg-primary-600 px-ds-3 py-2 text-ds-sm font-medium text-white shadow-ds-card transition-colors hover:bg-primary-500 disabled:opacity-50"
          aria-label={t('header.refreshGraph')}
        >
          <span aria-hidden="true" className={isRefreshing ? 'inline-block animate-spin' : ''}>↺</span>
          <span className="hidden text-ds-xs sm:inline">
            {isRefreshing ? t('header.refreshing') : t('header.refresh')}
          </span>
        </button>
        {refreshError && (
          <span role="alert" className="ml-ds-1 text-ds-xs text-rose-400">
            {refreshError}
          </span>
        )}
      </div>
    </header>
  )
}
