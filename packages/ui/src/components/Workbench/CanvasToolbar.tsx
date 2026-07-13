import { useTranslation } from 'react-i18next'
import type { ArchitectureDepth, WorkbenchView } from '../../types/workbench'
import { WorkbenchIcon } from './WorkbenchIcon'

interface CanvasToolbarProps {
  view: WorkbenchView
  depth: ArchitectureDepth
  focusAvailable: boolean
  onDepthChange: (depth: ArchitectureDepth) => void
  onFit: () => void
}

const DEPTHS: Array<{ id: ArchitectureDepth; labelKey: string; defaultLabel: string }> = [
  { id: 'overview', labelKey: 'workbench.depth.overview', defaultLabel: 'Overview' },
  { id: 'full', labelKey: 'workbench.depth.full', defaultLabel: 'Full graph' },
  { id: 'focus', labelKey: 'workbench.depth.focus', defaultLabel: 'Focus' },
]

export function CanvasToolbar({ view, depth, focusAvailable, onDepthChange, onFit }: CanvasToolbarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-2">
      {view === 'architecture' ? (
        <div className="flex min-w-0 items-center rounded-md border border-border-subtle bg-surface p-0.5" aria-label={t('workbench.depth.label', 'Architecture detail level')}>
          {DEPTHS.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={depth === item.id}
              disabled={item.id === 'focus' && !focusAvailable}
              title={item.id === 'focus' && !focusAvailable ? t('workbench.depth.focusHint', 'Select a node to enter focus mode') : undefined}
              onClick={() => onDepthChange(item.id)}
              className={`h-7 whitespace-nowrap rounded px-2 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5 sm:text-[11px] ${depth === item.id ? 'bg-surface-hover text-content' : 'text-content-muted hover:text-content-secondary'}`}
            >
              {t(item.labelKey, item.defaultLabel)}
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={onFit} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2 text-[11px] font-medium text-content-secondary hover:border-border-strong hover:text-content sm:px-2.5" aria-label={t('workbench.fitView', 'Fit view')}>
        <WorkbenchIcon name="focus" className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('workbench.fitView', 'Fit view')}</span>
      </button>
    </div>
  )
}
