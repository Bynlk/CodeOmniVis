import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { OmniGraph, OmniNode, NodeType } from '@codeomnivis/shared'
import { NODE_COLORS } from '../../lib/nodeConfig'
import type { WorkbenchView } from '../../types/workbench'
import { WorkbenchIcon } from './WorkbenchIcon'

const VIEW_META: Record<
  WorkbenchView,
  { titleKey: string; title: string; descriptionKey: string; description: string }
> = {
  architecture: {
    titleKey: 'workbench.view.architecture',
    title: 'Architecture',
    descriptionKey: 'workbench.description.architectureShort',
    description: 'System shape and ownership',
  },
  requests: {
    titleKey: 'workbench.view.requestFlow',
    title: 'Request flow',
    descriptionKey: 'workbench.description.requestsShort',
    description: 'UI to API to data',
  },
  data: {
    titleKey: 'workbench.view.data',
    title: 'Data model',
    descriptionKey: 'workbench.description.dataShort',
    description: 'Queries and schema relations',
  },
  tests: {
    titleKey: 'workbench.view.tests',
    title: 'Tests',
    descriptionKey: 'workbench.description.testsShort',
    description: 'Suites and production coverage',
  },
  quality: {
    titleKey: 'workbench.view.quality',
    title: 'Quality',
    descriptionKey: 'workbench.description.qualityShort',
    description: 'Parser findings and risks',
  },
}

const EMPTY_COPY: Record<Exclude<WorkbenchView, 'quality'>, { key: string; value: string }> = {
  architecture: {
    key: 'workbench.empty.architecture.explorer',
    value: 'No architecture nodes detected. Open Full graph or run analysis again.',
  },
  requests: {
    key: 'workbench.empty.requests.explorer',
    value: 'No request nodes detected in the latest analysis.',
  },
  data: {
    key: 'workbench.empty.data.explorer',
    value: 'No data nodes detected in the latest analysis.',
  },
  tests: {
    key: 'workbench.empty.tests.explorer',
    value: 'No test nodes detected in the latest analysis.',
  },
}

interface ExplorerPanelProps {
  graph?: OmniGraph
  view: WorkbenchView
  isAnalyzed?: boolean
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
}

export function ExplorerPanel({
  graph,
  view,
  isAnalyzed = true,
  selectedNodeId,
  onNodeSelect,
}: ExplorerPanelProps) {
  const { t } = useTranslation()
  const groups = useMemo(() => {
    const map = new Map<NodeType, OmniNode[]>()
    for (const node of graph?.nodes ?? []) map.set(node.type, [...(map.get(node.type) ?? []), node])
    return [...map.entries()]
  }, [graph])

  const meta = VIEW_META[view]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border-subtle px-3 py-3">
        <div className="flex items-center gap-2">
          <WorkbenchIcon name="layers" className="h-4 w-4 text-content-muted" />
          <h2 className="text-xs font-semibold text-content">{t(meta.titleKey, meta.title)}</h2>
        </div>
        <p className="mt-1 pl-6 text-[11px] text-content-muted">
          {t(meta.descriptionKey, meta.description)}
        </p>
      </div>
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2 text-[11px] text-content-muted">
        <span>{t('workbench.explorer', 'Explorer')}</span>
        <span className="font-mono tabular-nums">{graph?.nodes.length ?? 0}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] leading-5 text-content-muted">
            {!isAnalyzed
              ? t(
                  'workbench.empty.notAnalyzed.explorer',
                  'Run the first analysis to populate this workspace.',
                )
              : view === 'quality'
                ? t('workbench.quality.noLatest', 'No findings in the latest analysis.')
                : t(EMPTY_COPY[view].key, EMPTY_COPY[view].value)}
          </div>
        ) : (
          groups.map(([type, nodes]) => (
            <section key={type} className="mb-3">
              <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-medium text-content-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[type] }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {t(`nodeType.${type}`, type.replaceAll('_', ' '))}
                </span>
                <span className="font-mono">{nodes.length}</span>
              </div>
              <div>
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onNodeSelect(node.id)}
                    title={node.filePath}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${selectedNodeId === node.id ? 'bg-primary-500/10 text-content' : 'text-content-secondary hover:bg-surface-hover hover:text-content'}`}
                  >
                    <WorkbenchIcon
                      name={node.type === 'db_model' ? 'database' : 'file'}
                      className={`h-3.5 w-3.5 shrink-0 ${selectedNodeId === node.id ? 'text-primary-400' : 'text-content-muted'}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{node.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
