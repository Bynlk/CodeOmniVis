import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { TabId } from '../../types/tabs'
import { findGroupOfTab } from './tabGroups'

interface TabPanelProps {
  activeTab: TabId | null
  onTabChange: (tab: TabId | null) => void
}

/**
 * Dock 式分析/工具面板(feature-004)。
 *
 * 与旧实现的关键区别:不再 `absolute` 覆盖画布,而是作为一个独立的右侧 dock 列
 * 存在于 flex 布局中——面板打开时画布收窄而非被盖(AC1)。
 * 面板顶部提供同组子 tab 的子导航(如 分析组: 筛选/数据流/追踪)。
 * 无 activeTab(图谱视图)时不渲染,画布占满。
 *
 * feature-009 性能:面板组件为 React.lazy(见 tabGroups),此处以 Suspense 包裹并给出
 * 加载占位,避免切 tab 白屏,同时把非首屏面板代码移出入口主 chunk。
 */
export function TabPanel({ activeTab, onTabChange }: TabPanelProps) {
  const { t } = useTranslation()
  const group = findGroupOfTab(activeTab)
  if (!group || !activeTab) return null

  const child = group.children.find((c) => c.id === activeTab)
  const PanelComponent = child?.panelComponent ?? null
  if (!PanelComponent) return null

  const showSubNav = group.children.length > 1

  return (
    <>
      {/* 移动端遮罩(<md):点击关闭,面板此时全屏覆盖不挤压画布 */}
      <div
        className="fixed inset-0 z-30 bg-black/50 md:hidden"
        onClick={() => onTabChange(null)}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-full flex-col border-l border-slate-700
                   bg-slate-800 shadow-ds-panel
                   md:static md:z-auto md:h-full md:w-96 md:max-w-[40%] md:shrink-0"
        role="tabpanel"
        aria-label={t(group.labelKey)}
      >
      {/* 面板头:分组标题 + 关闭 */}
      <div className="flex items-center justify-between border-b border-slate-700 px-ds-4 py-ds-2">
        <span className="flex items-center gap-1.5 text-ds-sm font-medium text-slate-100">
          <span aria-hidden="true">{group.emoji}</span>
          {t(group.labelKey)}
        </span>
        <button
          type="button"
          onClick={() => onTabChange(null)}
          aria-label={t('panel.close')}
          className="rounded-ds-sm px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          ✕
        </button>
      </div>

      {/* 子导航(同组多个子 tab 时才显示) */}
      {showSubNav && (
        <div className="flex items-center gap-1 border-b border-slate-700 px-ds-2 py-1.5" role="tablist">
          {group.children.map((c) => {
            const active = c.id === activeTab
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(c.id)}
                className={`flex items-center gap-1 rounded-ds-sm px-ds-2 py-1 text-ds-xs
                            transition-colors focus:outline-none focus-visible:ring-2
                            focus-visible:ring-primary-400 ${
                              active
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
              >
                <span aria-hidden="true">{c.emoji}</span>
                <span>{t(c.labelKey)}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 面板内容 */}
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<div className="p-ds-4 text-ds-sm text-slate-400">{t('app.loadingGraph')}</div>}>
          <PanelComponent />
        </Suspense>
        </div>
      </aside>
    </>
  )
}
