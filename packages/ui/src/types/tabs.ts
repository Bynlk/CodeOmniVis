import type { ComponentType } from 'react'

export type TabId = 'graph' | 'filter' | 'issues' | 'ai' | 'stats' | 'dataflow'

export interface TabConfig {
  id: TabId
  labelKey: string       // i18n key
  emoji: string
  badgeCount?: number    // issues 用，显示红色数字
  panelComponent: ComponentType | null  // null = 无面板（graph tab）
}
