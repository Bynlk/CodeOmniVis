import type { ReactNode } from 'react'

interface AppShellProps {
  /** 跳转到主内容的无障碍链接文案。 */
  skipToMainLabel: string
  /** 顶部导航栏(跨全宽,sticky)。 */
  header: ReactNode
  /** 顶层分组导航条(Header 之下,跨全宽)。 */
  tabBar: ReactNode
  /** 左侧节点侧栏(桌面常驻 / 移动抽屉,组件自管响应式)。 */
  sidebar: ReactNode
  /** 中央主画布区。 */
  main: ReactNode
  /** 右轨:详情面板 / 分析 dock(二者互斥,组件自管)。 */
  rightRegion?: ReactNode
  /** 右轨是否占位 —— 决定主体是二轨还是三轨栅格。 */
  isRightTrackOpen: boolean
  /** 模态浮层(命令面板 / 设置抽屉),渲染在 shell 之上。 */
  overlays?: ReactNode
}

/**
 * feature-011 应用外壳(表现层从 0 重写)。
 *
 * 语义分区(桌面):
 *   ┌──────────────── Header (sticky, 跨全宽) ────────────────┐
 *   ├──────────────── TabBar (跨全宽) ───────────────────────┤
 *   │ Sidebar │            Main (画布)           │ RightRegion │
 *   └─────────┴─────────────────────────────────┴─────────────┘
 *
 * - Header + TabBar 用 flex 纵向堆叠在顶部,永远可见。
 * - 主体用 CSS Grid:右轨仅在详情/分析面板打开时出现(占轨道而非 absolute 遮盖),
 *   画布随之收窄 —— 消灭旧实现的浮层压画布问题(brief M-系列)。
 * - Sidebar / RightRegion 各自封装响应式(桌面进轨道,移动降级为抽屉)。
 * - 模态浮层(overlays)脱离栅格,置于最外层。
 */
export function AppShell({
  skipToMainLabel,
  header,
  tabBar,
  sidebar,
  main,
  rightRegion,
  isRightTrackOpen,
  overlays,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-content">
      {/* 键盘 Tab 首个可达元素 —— 聚焦时可见,直达主内容(a11y) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-ds-2 focus:top-ds-2 focus:z-modal
                   focus:rounded-ds-md focus:bg-primary-600 focus:px-ds-3 focus:py-ds-2 focus:text-white"
      >
        {skipToMainLabel}
      </a>

      {overlays}

      {/* 顶部固定区:品牌/搜索/状态 + 分组导航 */}
      <div className="z-panel flex shrink-0 flex-col">
        {header}
        {tabBar}
      </div>

      {/* 主体:栅格三轨(侧栏 auto | 画布 1fr | 右轨 auto),右轨按需占位 */}
      <div
        className={`grid min-h-0 flex-1 overflow-hidden ${
          isRightTrackOpen ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[auto_1fr]'
        }`}
      >
        {sidebar}
        {main}
        {rightRegion}
      </div>
    </div>
  )
}

export default AppShell
