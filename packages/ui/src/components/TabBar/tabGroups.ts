import type { TabGroup } from '../../types/tabs'
import { FilterPanel } from '../Filter/FilterPanel'
import { IssuesPanel } from './IssuesPanel'
import { AiPanel } from './AiPanel'
import { StatsPanel } from './StatsPanel'
import { DataFlowPanel } from './DataFlowPanel'
import { TracePanel } from './TracePanel'

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
