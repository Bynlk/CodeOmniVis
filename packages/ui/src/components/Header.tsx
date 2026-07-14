import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LangToggle } from './Header/LangToggle'
import { useStatus } from '../hooks/useStatus'
import { invalidateAnalysisQueries } from '../hooks/invalidateAnalysisQueries'
import { postAnalyze, ApiError } from '../services'
import { useUiStore } from '../store/uiStore'
import { WorkbenchIcon } from './Workbench/WorkbenchIcon'
import { BrandLogo } from './BrandLogo'

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
      await invalidateAnalysisQueries(queryClient)
    } catch (err) {
      const errorMsg = err instanceof ApiError
        ? t('header.refreshFailed', { status: err.status, statusText: err.statusText })
        : err instanceof Error ? err.message : t('common.unknownError')
      setRefreshError(errorMsg)
    } finally {
      setIsRefreshing(false)
    }
  }

  const freshnessLabel = status.lastAnalyzedAt === null
    ? t('freshness.never')
    : t(`freshness.${status.state}`, status.state)

  return (
    <header className="flex h-full min-w-0 items-center justify-between gap-3 px-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          onClick={() => toggleMobileDrawer(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-content-secondary transition-colors hover:bg-surface-hover hover:text-content md:hidden"
          aria-label={t('menu.open')}
          title={t('menu.open')}
        >
          <span aria-hidden="true" className="text-base">≡</span>
        </button>
        <div className="flex h-7 items-center gap-2 border-r border-border-subtle pr-3">
          <h1 className="truncate text-xs text-content">
            <BrandLogo showWordmark markClassName="h-6 w-6" />
          </h1>
        </div>
        <div className="hidden min-w-0 items-center gap-2 text-[11px] sm:flex">
          <span className="text-content-muted">{t('workbench.workspace', 'Workspace')}</span><span className="text-border-strong">/</span><span className="truncate text-content-secondary">{t('workbench.localProject', 'Local project')}</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        {onQueryChange && (
          <div className="relative hidden sm:block">
            <WorkbenchIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query || ''}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t('header.searchPlaceholder', { shortcut: '⌘K' })}
              className="h-8 w-48 rounded-md border border-border-subtle bg-[#090b0f] pl-8 pr-10 text-[11px] text-content placeholder:text-content-muted focus:border-primary-500 focus:outline-none md:w-64"
              aria-label={t('header.searchNodes')}
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border-subtle px-1 py-0.5 font-mono text-[9px] text-content-muted">
              ⌘K
            </kbd>
          </div>
        )}
        <div className="hidden h-8 items-center gap-2 rounded-md px-2 text-[10px] text-content-muted md:flex" title={freshnessLabel}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.state === 'fresh' ? 'bg-emerald-400' : status.state === 'analyzing' ? 'bg-amber-400' : 'bg-slate-400'}`} />
          {freshnessLabel}
        </div>
        <LangToggle />
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('settings.open')}
            title={t('settings.title')}
          >
            <WorkbenchIcon name="settings" className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex h-8 items-center gap-1.5 rounded-md bg-primary-600 px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
          aria-label={t('header.refreshGraph')}
        >
          <WorkbenchIcon name="refresh" className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">
            {isRefreshing ? t('header.refreshing') : t('header.refresh')}
          </span>
        </button>
        {refreshError && (
          <span role="alert" className="ml-1 max-w-40 truncate text-[10px] text-rose-400">
            {refreshError}
          </span>
        )}
      </div>
    </header>
  )
}
