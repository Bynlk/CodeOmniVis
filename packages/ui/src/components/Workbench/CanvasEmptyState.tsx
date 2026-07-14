import { useTranslation } from 'react-i18next'
import type { WorkbenchView } from '../../types/workbench'

const EMPTY_COPY: Record<
  Exclude<WorkbenchView, 'quality'>,
  { titleKey: string; title: string; descriptionKey: string; description: string }
> = {
  architecture: {
    titleKey: 'workbench.empty.architecture.title',
    title: 'No architecture nodes detected',
    descriptionKey: 'workbench.empty.architecture.description',
    description:
      'Run analysis again or open Full graph to inspect every parsed implementation node.',
  },
  requests: {
    titleKey: 'workbench.empty.requests.title',
    title: 'No request paths detected',
    descriptionKey: 'workbench.empty.requests.description',
    description:
      'Request flow appears after render, API call, handler, service, or query relationships are found.',
  },
  data: {
    titleKey: 'workbench.empty.data.title',
    title: 'No data relationships detected',
    descriptionKey: 'workbench.empty.data.description',
    description:
      'This project has no parsed Prisma, TypeORM, or query relationships in the current analysis.',
  },
  tests: {
    titleKey: 'workbench.empty.tests.title',
    title: 'No tests discovered',
    descriptionKey: 'workbench.empty.tests.description',
    description: 'Add supported TypeScript or Kotlin tests and run analysis again.',
  },
}

interface CanvasEmptyStateProps {
  view: Exclude<WorkbenchView, 'quality'>
  hasSearchQuery: boolean
  isAnalyzed?: boolean
}

export function CanvasEmptyState({
  view,
  hasSearchQuery,
  isAnalyzed = true,
}: CanvasEmptyStateProps) {
  const { t } = useTranslation()
  const copy = !isAnalyzed
    ? {
        titleKey: 'workbench.empty.notAnalyzed.title',
        title: 'Project not analyzed yet',
        descriptionKey: 'workbench.empty.notAnalyzed.description',
        description:
          'Run the first analysis to populate this workspace with architecture nodes and relationships.',
      }
    : hasSearchQuery
      ? {
          titleKey: 'workbench.empty.search.title',
          title: 'No nodes match this search',
          descriptionKey: 'workbench.empty.search.description',
          description: 'Clear the search or use a broader file, symbol, or node-type query.',
        }
      : EMPTY_COPY[view]

  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div
          className="mx-auto mb-4 h-8 w-8 rounded-md border border-border-strong bg-surface-panel"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold text-content">{t(copy.titleKey, copy.title)}</h2>
        <p className="mt-2 text-xs leading-5 text-content-muted">
          {t(copy.descriptionKey, copy.description)}
        </p>
      </div>
    </div>
  )
}
