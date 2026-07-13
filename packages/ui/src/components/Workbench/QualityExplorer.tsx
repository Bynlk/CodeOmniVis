import { useTranslation } from 'react-i18next'
import type { IssueDetectorStatus } from '@codeomnivis/shared'
import type { QualityFinding, QualitySeverity, QualitySource } from '../../lib/qualityFindings'
import { WorkbenchIcon } from './WorkbenchIcon'

interface QualityExplorerProps {
  findings: QualityFinding[]
  isLoading?: boolean
  detectors?: IssueDetectorStatus[]
  parserError?: Error | null
  issuesError?: Error | null
}

const SEVERITIES: Array<{ id: QualitySeverity; color: string }> = [
  { id: 'critical', color: 'bg-red-400' },
  { id: 'error', color: 'bg-rose-400' },
  { id: 'warning', color: 'bg-amber-400' },
  { id: 'info', color: 'bg-sky-400' },
]

const SOURCES: QualitySource[] = ['parser', 'consistency', 'security', 'performance', 'framework']

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase())
}

export function QualityExplorer({
  findings,
  isLoading = false,
  detectors = [],
  parserError,
  issuesError,
}: QualityExplorerProps) {
  const { t } = useTranslation()
  const failedDetectors = detectors.filter(detector => detector.status === 'failed')
  const unavailable = Boolean(parserError && issuesError)
  const partial = !unavailable && Boolean(
    parserError || issuesError || failedDetectors.length > 0 || (isLoading && findings.length > 0),
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border-subtle px-3 py-3">
        <div className="flex items-center gap-2">
          <WorkbenchIcon name="quality" className="h-4 w-4 text-content-muted" />
          <h2 className="text-xs font-semibold text-content">{t('workbench.view.quality', 'Quality')}</h2>
        </div>
        <p className="mt-1 pl-6 text-[11px] text-content-muted">{t('workbench.description.qualityShort', 'Parser output and deterministic risks')}</p>
      </div>
      <div className="border-b border-border-subtle px-3 py-2 text-[11px] text-content-muted">{t('workbench.latestAnalysis', 'Latest analysis')}</div>

      {isLoading && findings.length === 0 ? (
        <div className="space-y-2 p-3" aria-label={t('workbench.quality.loading', 'Loading quality findings')}>
          {[1, 2, 3].map(item => <div key={item} className="h-8 animate-pulse rounded-md bg-surface-hover" />)}
        </div>
      ) : unavailable ? (
        <div className="m-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-[11px] leading-5 text-rose-300" role="alert">
          {t('workbench.quality.unavailable', 'Quality data unavailable')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {partial ? (
            <div className="m-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] leading-5 text-amber-200" role="status">
              {t('workbench.quality.partial', 'Partial quality results')}
            </div>
          ) : null}

          <div className="border-b border-border-subtle px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            {t('workbench.quality.severitySection', 'Severity')}
          </div>
          <div className="space-y-1 p-2">
            {SEVERITIES.map(severity => {
              const count = findings.filter(finding => finding.severity === severity.id).length
              return (
                <div key={severity.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-content-secondary">
                  <span className={`h-1.5 w-1.5 rounded-full ${severity.color}`} aria-hidden="true" />
                  <span className="flex-1 capitalize">{t(`workbench.severity.${severity.id}`, severity.id)}</span>
                  <span className="font-mono tabular-nums text-content-muted">{count}</span>
                </div>
              )
            })}
          </div>

          {SOURCES.some(source => findings.some(finding => finding.source === source)) ? (
            <>
              <div className="border-y border-border-subtle px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                {t('workbench.quality.sourcesSection', 'Sources')}
              </div>
              <div className="space-y-1 p-2">
                {SOURCES.map(source => {
                  const count = findings.filter(finding => finding.source === source).length
                  if (count === 0) return null
                  const label = t(`workbench.source.${source}`, humanize(source))
                  return (
                    <div key={source} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-content-secondary">
                      <span className="flex-1">{label}</span>
                      <span className="font-mono tabular-nums text-content-muted">{count}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      )}

      <p className="mt-auto border-t border-border-subtle p-3 text-[11px] leading-5 text-content-muted">
        {t('workbench.quality.note', 'Findings are deterministic parser output and project risks from the latest analysis.')}
      </p>
    </div>
  )
}
