import { useTranslation } from 'react-i18next'
import { useGraphErrors } from '../../hooks/useGraphErrors'

const SEVERITY_EMOJI: Record<string, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

const SEVERITY_ACCENT: Record<string, string> = {
  error: 'border-l-rose-500',
  warning: 'border-l-amber-500',
  info: 'border-l-sky-500',
}

export function IssuesPanel() {
  const { t } = useTranslation()
  const { data: errors, isLoading, error } = useGraphErrors()

  if (isLoading) {
    return <div className="p-ds-4 text-ds-sm text-content-muted">{t('issues.loading')}</div>
  }

  if (error) {
    return <div className="p-ds-4 text-ds-sm text-rose-400">{t('issues.failedToLoad')}</div>
  }

  if (!errors || errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-ds-6">
        <span className="text-2xl">✅</span>
        <p className="text-ds-sm text-content-secondary">{t('issues.noIssuesFound')}</p>
      </div>
    )
  }

  // 按严重度分组
  const grouped = {
    error: errors.filter(e => e.severity === 'error'),
    warning: errors.filter(e => e.severity === 'warning'),
    info: errors.filter(e => e.severity === 'info'),
  }

  return (
    <div className="max-h-full overflow-y-auto p-ds-4">
      {/* 统计 */}
      <div className="mb-ds-3 flex flex-wrap gap-ds-3">
        {grouped.error.length > 0 && (
          <span className="text-ds-xs text-rose-400">❌ {grouped.error.length} {t('issues.errors')}</span>
        )}
        {grouped.warning.length > 0 && (
          <span className="text-ds-xs text-amber-400">⚠️ {grouped.warning.length} {t('issues.warnings')}</span>
        )}
        {grouped.info.length > 0 && (
          <span className="text-ds-xs text-sky-400">ℹ️ {grouped.info.length} {t('issues.info')}</span>
        )}
      </div>

      {/* 错误列表 */}
      <div className="space-y-ds-2">
        {errors.map((err, i) => (
          <div
            key={`${err.file}-${i}`}
            className={`flex items-start gap-ds-2 rounded-ds-md border-l-2 ${SEVERITY_ACCENT[err.severity] ?? 'border-l-sky-500'} bg-surface-hover/60 p-ds-2 text-ds-sm`}
          >
            <span className="mt-0.5 shrink-0">{SEVERITY_EMOJI[err.severity] ?? 'ℹ️'}</span>
            <div className="min-w-0 flex-1">
              <div className="break-words text-content-secondary">{err.message}</div>
              {err.file && (
                <div className="mt-0.5 truncate text-ds-xs text-content-muted">
                  {err.file}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
