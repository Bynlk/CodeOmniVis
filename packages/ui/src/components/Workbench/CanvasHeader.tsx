import { useTranslation } from 'react-i18next'
import type { OmniGraph } from '@codeomnivis/shared'
import type { ArchitectureDepth, WorkbenchView } from '../../types/workbench'
import { CanvasToolbar } from './CanvasToolbar'

const VIEW_COPY: Record<WorkbenchView, { titleKey: string; title: string; descriptionKey: string; description: string }> = {
  architecture: { titleKey: 'workbench.view.architecture', title: 'Architecture', descriptionKey: 'workbench.description.architecture', description: 'Explore system boundaries and implementation layers' },
  requests: { titleKey: 'workbench.view.requestFlow', title: 'Request flow', descriptionKey: 'workbench.description.requests', description: 'Follow runtime paths from interface to persistence' },
  data: { titleKey: 'workbench.view.data', title: 'Data model', descriptionKey: 'workbench.description.data', description: 'Inspect queries, ownership, and schema relations' },
  tests: { titleKey: 'workbench.view.tests', title: 'Tests', descriptionKey: 'workbench.description.tests', description: 'Explore suites, fixtures, and static production coverage' },
  quality: { titleKey: 'workbench.view.quality', title: 'Quality', descriptionKey: 'workbench.description.quality', description: 'Review parser output and deterministic project risks' },
}

interface CanvasHeaderProps {
  view: WorkbenchView
  graph?: OmniGraph
  depth: ArchitectureDepth
  focusAvailable: boolean
  findingCount?: number
  onDepthChange: (depth: ArchitectureDepth) => void
  onFit: () => void
}

export function CanvasHeader({ view, graph, depth, focusAvailable, findingCount = 0, onDepthChange, onFit }: CanvasHeaderProps) {
  const { t } = useTranslation()
  const copy = VIEW_COPY[view]
  return (
    <header className="flex min-h-14 shrink-0 flex-col items-stretch justify-between gap-2 border-b border-border-subtle bg-[#0b0e13] px-3 py-2 sm:h-14 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="text-xs font-semibold text-content">{t(copy.titleKey, copy.title)}</span><span className="hidden text-[10px] text-content-muted lg:inline">/</span><span className="hidden truncate text-[11px] text-content-muted lg:inline">{t(copy.descriptionKey, copy.description)}</span></div>
        <div className="mt-1 hidden items-center gap-3 font-mono text-[10px] text-content-muted sm:flex">
          {view === 'quality'
            ? <span>{t('workbench.count.findings', { defaultValue: `${findingCount} findings`, count: findingCount })}</span>
            : <><span>{t('workbench.count.nodes', { defaultValue: `${graph?.nodes.length ?? 0} nodes`, count: graph?.nodes.length ?? 0 })}</span><span>{t('workbench.count.edges', { defaultValue: `${graph?.edges.length ?? 0} edges`, count: graph?.edges.length ?? 0 })}</span></>}
        </div>
      </div>
      {view !== 'quality' ? <CanvasToolbar view={view} depth={depth} focusAvailable={focusAvailable} onDepthChange={onDepthChange} onFit={onFit} /> : null}
    </header>
  )
}
