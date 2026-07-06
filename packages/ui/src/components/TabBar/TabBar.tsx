import { useTranslation } from 'react-i18next'
import type { TabId } from '../../types/tabs'
import { TAB_GROUPS, findGroupOfTab } from './tabGroups'

interface TabBarProps {
  activeTab: TabId | null
  onTabChange: (tab: TabId | null) => void
  issueBadgeCount: number
}

/**
 * 顶层分组导航(feature-004)。渲染 ≤4 个主分组:
 * - 图谱组:无子面板,点击 → activeTab=null(全屏画布)。
 * - 其它组:点击 → 激活该组第一个子 tab;再次点击已激活组 → 收起(回到画布)。
 * 子 tab 之间的切换由 dock 面板内的子导航负责。
 */
export function TabBar({ activeTab, onTabChange, issueBadgeCount }: TabBarProps) {
  const { t } = useTranslation()
  const activeGroup = findGroupOfTab(activeTab)

  return (
    <div
      className="flex items-center border-b border-slate-700 bg-slate-800 px-ds-4"
      role="tablist"
      aria-label={t('group.graph')}
    >
      {TAB_GROUPS.map((group) => {
        const isGraph = group.children.length === 0
        const isActive = isGraph ? activeTab === null : activeGroup?.id === group.id
        const badge = group.showIssueBadge ? issueBadgeCount : undefined

        return (
          <button
            key={group.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (isGraph) {
                onTabChange(null)
              } else if (isActive) {
                onTabChange(null) // 再次点击已激活组 → 收起面板
              } else {
                onTabChange(group.children[0].id) // 打开该组首个子 tab
              }
            }}
            className={`relative flex items-center gap-1.5 px-ds-4 py-2.5 text-ds-sm
                        border-b-2 transition-colors focus:outline-none
                        focus-visible:ring-2 focus-visible:ring-primary-400 ${
                          isActive
                            ? 'border-primary-500 text-white'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
          >
            <span aria-hidden="true">{group.emoji}</span>
            <span>{t(group.labelKey)}</span>
            {badge !== undefined && badge > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-ds-xs text-white">
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
