import { useTranslation } from 'react-i18next'
import type { TabId, TabConfig } from '../../types/tabs'

interface TabBarProps {
  activeTab: TabId | null
  onTabChange: (tab: TabId | null) => void
  issueBadgeCount: number
  tabs: TabConfig[]
}

export function TabBar({ activeTab, onTabChange, issueBadgeCount, tabs }: TabBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center border-b border-slate-700 bg-slate-800 px-4">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        const count = tab.id === 'issues' ? issueBadgeCount : undefined

        return (
          <button
            key={tab.id}
            onClick={() => {
              // 图谱 tab 没有 panel，点击直接回到图谱视图
              if (!tab.panelComponent) {
                onTabChange(null)
              } else {
                onTabChange(isActive ? null : tab.id)
              }
            }}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm
                        border-b-2 transition-colors ${
                          isActive || (!tab.panelComponent && !activeTab)
                            ? 'border-blue-500 text-white'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
          >
            <span>{tab.emoji}</span>
            <span>{t(tab.labelKey)}</span>
            {count !== undefined && count > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
