import { useTranslation } from 'react-i18next'
import type { WorkbenchView } from '../../types/workbench'

const ERROR_COPY: Record<Exclude<WorkbenchView, 'quality'>, { key: string; value: string }> = {
  architecture: {
    key: 'workbench.error.architecture',
    value: 'Unable to load the architecture graph',
  },
  requests: {
    key: 'workbench.error.requests',
    value: 'Unable to load request flow',
  },
  data: {
    key: 'workbench.error.data',
    value: 'Unable to load the data model',
  },
  tests: { key: 'workbench.error.tests', value: 'Unable to load the test view' },
}

interface CanvasErrorStateProps {
  view: Exclude<WorkbenchView, 'quality'>
  error: Error
}

export function CanvasErrorState({ view, error }: CanvasErrorStateProps) {
  const { t } = useTranslation()
  const copy = ERROR_COPY[view]
  return (
    <div className="m-5 border-l-2 border-rose-400 bg-rose-500/5 px-4 py-3 text-xs text-rose-200" role="alert">
      <p className="font-medium">{t(copy.key, copy.value)}</p>
      <p className="mt-1 break-all font-mono text-[10px] text-rose-300/80">{error.message}</p>
    </div>
  )
}
