import type { ComponentType } from 'react'

export type TabId = 'graph' | 'filter' | 'issues' | 'ai' | 'stats' | 'dataflow' | 'trace'

export interface TabConfig {
  id: TabId
  labelKey: string       // i18n key
  emoji: string
  badgeCount?: number    // issues 用，显示红色数字
  panelComponent: ComponentType | null  // null = 无面板（graph tab）
}

/**
 * 顶层 tab 分组(feature-004,≤4 组)。
 * - graph 组无子项(点击回到全屏画布)。
 * - 其余组含 1..n 个子 tab,子 tab 在 dock 面板内以子导航切换。
 */
export interface TabGroup {
  id: string
  labelKey: string
  emoji: string
  /** 该组包含的叶子 tab;空数组表示纯画布组(graph)。 */
  children: TabConfig[]
  /** 是否在该组图标上显示问题 badge(仅 issues 组)。 */
  showIssueBadge?: boolean
}
