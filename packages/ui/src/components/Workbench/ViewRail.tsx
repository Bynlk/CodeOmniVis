import { useTranslation } from 'react-i18next'
import type { WorkbenchView } from '../../types/workbench'
import { BrandLogo } from '../BrandLogo'
import { WorkbenchIcon, type WorkbenchIconName } from './WorkbenchIcon'

const VIEWS: Array<{
  id: WorkbenchView
  labelKey: string
  defaultLabel: string
  icon: WorkbenchIconName
}> = [
  {
    id: 'architecture',
    labelKey: 'workbench.view.architecture',
    defaultLabel: 'Architecture',
    icon: 'architecture',
  },
  {
    id: 'requests',
    labelKey: 'workbench.view.requests',
    defaultLabel: 'Requests',
    icon: 'requests',
  },
  { id: 'data', labelKey: 'workbench.view.data', defaultLabel: 'Data model', icon: 'data' },
  { id: 'tests', labelKey: 'workbench.view.tests', defaultLabel: 'Tests', icon: 'tests' },
  { id: 'quality', labelKey: 'workbench.view.quality', defaultLabel: 'Quality', icon: 'quality' },
]

interface ViewRailProps {
  activeView: WorkbenchView
  onViewChange: (view: WorkbenchView) => void
  issueCount?: number
}

export function ViewRail({ activeView, onViewChange, issueCount = 0 }: ViewRailProps) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center py-2">
      <BrandLogo className="mb-3 text-content" markClassName="h-8 w-8" />
      <div className="flex w-full flex-1 flex-col items-center gap-1 px-1.5">
        {VIEWS.map((view) => {
          const active = activeView === view.id
          const label = t(view.labelKey, view.defaultLabel)
          return (
            <button
              key={view.id}
              data-testid={`view-${view.id}`}
              type="button"
              aria-label={label}
              title={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(view.id)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ${active ? 'bg-primary-600 text-white' : 'text-content-muted hover:bg-surface-hover hover:text-content'}`}
            >
              <WorkbenchIcon name={view.icon} className="h-[18px] w-[18px]" />
              {view.id === 'quality' && issueCount > 0 ? (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-rose-400" />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
