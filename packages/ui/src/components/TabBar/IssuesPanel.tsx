import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

interface Issue {
  file: string
  message: string
  severity: 'error' | 'warning' | 'info'
  originalError?: string
  type?: string
}

// 问题类型 → emoji 映射
const ISSUE_EMOJI: Record<string, string> = {
  dead_route: '🚫',
  dead_component: '🗑️',
  dead_service: '🔇',
  circular_dependency: '🔄',
  dead_api_call: '💀',
  unused_route: '📭',
  method_mismatch: '⚡',
  missing_procedure: '❓',
}

function getIssueEmoji(issue: Issue): string {
  if (issue.type && ISSUE_EMOJI[issue.type]) return ISSUE_EMOJI[issue.type]
  if (issue.severity === 'error') return '❌'
  if (issue.severity === 'warning') return '⚠️'
  return 'ℹ️'
}

async function fetchErrors(): Promise<Issue[]> {
  const res = await fetch('/api/graph/errors')
  if (!res.ok) throw new Error(`Failed to fetch errors: ${res.statusText}`)
  const json = await res.json()
  return json.data as Issue[]
}

export function IssuesPanel() {
  const { t } = useTranslation()
  const { data: issues, isLoading, error } = useQuery({
    queryKey: ['graph-errors'],
    queryFn: fetchErrors,
    refetchInterval: 5000,
  })

  if (isLoading) {
    return <div className="p-4 text-slate-400 text-sm">{t('issues.loading')}</div>
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{t('issues.failedToLoad')}</div>
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="p-4 text-center">
        <span className="text-green-400 text-lg">✅</span>
        <p className="text-slate-400 text-sm mt-1">{t('issues.noIssuesFound')}</p>
      </div>
    )
  }

  // 按严重度分组
  const grouped = {
    error: issues.filter(i => i.severity === 'error'),
    warning: issues.filter(i => i.severity === 'warning'),
    info: issues.filter(i => i.severity === 'info'),
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

      {/* 问题列表 */}
      <div className="space-y-2">
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 text-sm p-2 rounded bg-slate-700/50"
          >
            <span className="mt-0.5">
              {getIssueEmoji(issue)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-300 break-words">{issue.message}</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">{issue.file}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
