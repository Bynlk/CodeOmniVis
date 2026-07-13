import { useTranslation } from 'react-i18next'
import type { IssueDetectorStatus } from '@codeomnivis/shared'
import type { QualityFinding, QualitySeverity } from '../../lib/qualityFindings'
import { buildVsCodeSourceHref } from '../../lib/sourceLink'

interface QualityCanvasProps {
  findings: QualityFinding[]
  isLoading: boolean
  detectors?: IssueDetectorStatus[]
  parserError?: Error | null
  issuesError?: Error | null
  projectRoot?: string
}

const SEVERITIES: QualitySeverity[] = ['critical', 'error', 'warning', 'info']

const SEVERITY_STYLE: Record<QualitySeverity, string> = {
  critical: 'bg-red-400',
  error: 'bg-rose-400',
  warning: 'bg-amber-400',
  info: 'bg-sky-400',
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase())
}

export function QualityCanvas({
  findings,
  isLoading,
  detectors = [],
  parserError,
  issuesError,
  projectRoot,
}: QualityCanvasProps) {
  const { t } = useTranslation()
  const failedDetectors = detectors.filter(detector => detector.status === 'failed')
  const unavailable = Boolean(parserError && issuesError)
  const partial = !unavailable && Boolean(parserError || issuesError || failedDetectors.length > 0)
  const detectionComplete = detectors.length === 4 && failedDetectors.length === 0

  if (isLoading && findings.length === 0) {
    return (
      <div className="h-full overflow-auto p-6" aria-label={t('workbench.quality.loading', 'Loading quality findings')}>
        <div className="mb-6 h-5 w-40 animate-pulse rounded bg-surface-hover" />
        <div className="space-y-2">{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-md border border-border-subtle bg-surface" />)}</div>
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="m-6 rounded-md border border-rose-500/40 bg-rose-500/5 p-4" role="alert">
        <h2 className="text-sm font-semibold text-rose-200">{t('workbench.quality.unavailable', 'Quality data unavailable')}</h2>
        <p className="mt-1 text-xs leading-5 text-rose-300/80">{t('workbench.quality.unavailableDescription', 'Parser output and project risks could not be loaded.')}</p>
      </div>
    )
  }

  if (findings.length === 0 && !partial && detectionComplete) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" aria-hidden="true">✓</div>
          <h2 className="text-sm font-semibold text-content">{t('workbench.quality.none', 'No quality findings')}</h2>
          <p className="mt-2 text-xs leading-5 text-content-muted">{t('workbench.quality.noneDescription', 'No deterministic parser or project risks were reported by the latest analysis.')}</p>
        </div>
      </div>
    )
  }

  const counts = Object.fromEntries(
    SEVERITIES.map(severity => [severity, findings.filter(item => item.severity === severity).length]),
  ) as Record<QualitySeverity, number>

  return (
    <section className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-5" aria-label={t('workbench.view.quality', 'Quality')}>
      {partial || !detectionComplete ? (
        <div className="mb-4 rounded-md border border-amber-500/35 bg-amber-500/5 px-3 py-2.5" role="status">
          <p className="text-xs font-semibold text-amber-200">{t('workbench.quality.partial', 'Partial quality results')}</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-200/70">{t('workbench.quality.partialDescription', 'Some quality sources were unavailable. Visible findings remain valid, but this is not a complete health result.')}</p>
          {failedDetectors.length > 0 ? (
            <p className="mt-1 font-mono text-[10px] text-amber-200/70">
              {failedDetectors.map(detector => t(`workbench.detector.${detector.id}`, humanize(detector.id))).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-content">{t('workbench.count.findings', { defaultValue: `${findings.length} findings`, count: findings.length })}</h2>
          <p className="mt-1 text-xs text-content-muted">{t('workbench.quality.output', 'Deterministic parser output and project risks from the latest analysis.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-content-secondary">
          {SEVERITIES.map(severity => (
            <span key={severity} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLE[severity]}`} aria-hidden="true" />
              {counts[severity]} {t(`workbench.severity.${severity}`, severity)}
            </span>
          ))}
        </div>
      </div>

      <ol className="divide-y divide-border-subtle border-y border-border-subtle">
        {findings.map(finding => {
          const location = finding.locations[0]
          const locationLabel = location
            ? `${location.file}${location.line ? `:${location.line}` : ''}`
            : undefined
          const href = location
            ? buildVsCodeSourceHref(projectRoot, location.file, location.line ?? 1)
            : undefined
          const message = finding.messageKey
            ? t(`workbench.issueMessage.${finding.messageKey}`, {
                defaultValue: finding.message,
                ...finding.messageParams,
              })
            : finding.message
          return (
            <li key={finding.id} className="grid gap-2 px-2 py-3.5 hover:bg-surface-hover/50 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4">
              <span className="flex items-center gap-2 text-[11px] capitalize text-content-secondary">
                <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLE[finding.severity]}`} aria-hidden="true" />
                {t(`workbench.severity.${finding.severity}`, finding.severity)}
              </span>
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-content-secondary">
                    {t(`workbench.source.${finding.source}`, humanize(finding.source))}
                  </span>
                  <span className="rounded border border-border-subtle px-1.5 py-0.5 text-content-muted">
                    {t(`workbench.issueType.${finding.type}`, humanize(finding.type))}
                  </span>
                </div>
                <p className="text-xs leading-5 text-content">{message}</p>
                {locationLabel ? href ? (
                  <a
                    href={href}
                    className="mt-1 inline-block max-w-full truncate font-mono text-[11px] text-content-muted underline decoration-border-strong underline-offset-2 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    aria-label={t('workbench.quality.openLocation', { defaultValue: `Open ${locationLabel} in VS Code`, location: locationLabel })}
                  >
                    {locationLabel}
                  </a>
                ) : (
                  <p className="mt-1 truncate font-mono text-[11px] text-content-muted">{locationLabel}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
