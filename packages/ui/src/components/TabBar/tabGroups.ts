import { lazy } from 'react'
import type { TabGroup } from '../../types/tabs'

// feature-009 性能:分析/问题/智能类面板均非首屏,改为 React.lazy 按需加载,
// 不进入入口主 chunk(TabPanel 内以 Suspense 包裹 + 骨架占位)。命名导出经 .then 适配 default。
const FilterPanel = lazy(() => import('../Filter/FilterPanel').then((m) => ({ default: m.FilterPanel })))
const IssuesPanel = lazy(() => import('./IssuesPanel').then((m) => ({ default: m.IssuesPanel })))
const AiPanel = lazy(() => import('./AiPanel').then((m) => ({ default: m.AiPanel })))
const StatsPanel = lazy(() => import('./StatsPanel').then((m) => ({ default: m.StatsPanel })))
const DataFlowPanel = lazy(() => import('./DataFlowPanel').then((m) => ({ default: m.DataFlowPanel })))
const TracePanel = lazy(() => import('./TracePanel').then((m) => ({ default: m.TracePanel })))

/**
 * 顶层 tab 分组(feature-004,4 组,满足 ≤4)。
 * 不删除任何功能面板,仅重新归类(Non-Goals)。
 *  1. 图谱   —— 无子面板,点击回到全屏画布
 *  2. 分析   —— filter + dataflow + trace
 *  3. 问题   —— issues(带 badge)
 *  4. 智能   —— ai + stats
 */
export const TAB_GROUPS: TabGroup[] = [
  {
    id: 'graph',
    labelKey: 'group.graph',
    emoji: '🗺️',
    children: [],
  },
  {
    id: 'analysis',
    labelKey: 'group.analysis',
    emoji: '🔬',
    children: [
      { id: 'filter',   labelKey: 'tab.filter',   emoji: '🔍', panelComponent: FilterPanel },
      { id: 'dataflow', labelKey: 'tab.dataflow', emoji: '🌊', panelComponent: DataFlowPanel },
      { id: 'trace',    labelKey: 'tab.trace',    emoji: '🛤️', panelComponent: TracePanel },
    ],
  },
  {
    id: 'issues',
    labelKey: 'group.issues',
    emoji: '⚠️',
    showIssueBadge: true,
    children: [
      { id: 'issues', labelKey: 'tab.issues', emoji: '⚠️', panelComponent: IssuesPanel },
    ],
  },
  {
    id: 'intelligence',
    labelKey: 'group.intelligence',
    emoji: '✨',
    children: [
      { id: 'ai',    labelKey: 'tab.ai',    emoji: '🤖', panelComponent: AiPanel },
      { id: 'stats', labelKey: 'tab.stats', emoji: '📊', panelComponent: StatsPanel },
    ],
  },
]

/** 找到某叶子 tab 所属的分组。 */
export function findGroupOfTab(tabId: string | null): TabGroup | undefined {
  if (!tabId) return undefined
  return TAB_GROUPS.find((g) => g.children.some((c) => c.id === tabId))
}
