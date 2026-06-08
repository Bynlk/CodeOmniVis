import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

interface ParseError {
  file: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

async function fetchErrors(): Promise<ParseError[]> {
  const res = await fetch('/api/graph/errors')
  if (!res.ok) throw new Error(`Failed to fetch errors: ${res.statusText}`)
  const json = await res.json()
  return (json.data ?? []) as ParseError[]
}

const SEVERITY_EMOJI: Record<string, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

export function IssuesPanel() {
  const { t } = useTranslation()
  const { data: errors, isLoading, error } = useQuery({
    queryKey: ['graph-errors'],
    queryFn: fetchErrors,
    refetchInterval: 30000,
  })

  if (isLoading) {
    return <div className="p-4 text-slate-400 text-sm">{t('issues.loading')}</div>
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{t('issues.failedToLoad')}</div>
  }

  if (!errors || errors.length === 0) {
    return (
      <div className="p-4 text-center">
        <span className="text-green-400 text-lg">✅</span>
        <p className="text-slate-400 text-sm mt-1">{t('issues.noIssuesFound')}</p>
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
    <div className="p-4 max-h-56 overflow-y-auto">
      {/* 统计 */}
      <div className="flex gap-4 mb-3">
        {grouped.error.length > 0 && (
          <span className="text-xs text-red-400">❌ {grouped.error.length} {t('issues.errors')}</span>
        )}
        {grouped.warning.length > 0 && (
          <span className="text-xs text-yellow-400">⚠️ {grouped.warning.length} {t('issues.warnings')}</span>
        )}
        {grouped.info.length > 0 && (
          <span className="text-xs text-blue-400">ℹ️ {grouped.info.length} {t('issues.info')}</span>
        )}
      </div>

      {/* 错误列表 */}
      <div className="space-y-2">
        {errors.map((err, i) => (
          <div
            key={`${err.file}-${i}`}
            className="flex items-start gap-2 text-sm p-2 rounded bg-slate-700/50"
          >
            <span className="mt-0.5">{SEVERITY_EMOJI[err.severity] ?? 'ℹ️'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-300 break-words">{err.message}</div>
              {err.file && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">
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
