# CodeOmniVis 前端重设计计划书 v1.0

> 基于当前 DOM 结构分析 + 需求梳理
> 涵盖：风琴式导航 / 筛选器重构 / 节点 Tooltip + Emoji / i18n

---

## 一、变更总览

| 需求 | 当前状态 | 目标状态 |
|------|---------|---------|
| 顶部导航 | 单行 Header，搜索 + 刷新 | 双行 Header：品牌行 + Tab 栏，切换不同功能面板 |
| 筛选选项 | 左下角 8 个类型开关 | Tab 内独立筛选面板：节点类型 / 边类型 / 置信度 / 孤立节点 |
| 筛选后视口 | 每次筛选强制 fit，缩放重置 | 筛选前保存 pan/zoom，筛选后恢复 |
| 节点悬停 | 无 | 悬停 600ms 后显示浮层：类型、名称、文件路径 |
| 节点标识 | 仅颜色区分 | 颜色 + Emoji 双重标识 |
| 语言 | 英文硬编码 | react-i18next，zh-CN / en-US，右上角切换 |
| 刷新按钮 | 无事件（死代码） | 调用 React Query refetch，带 loading 状态 |

---

## 二、新布局结构

```
┌────────────────────────────────────────────────────────────────┐
│ BRAND BAR                                                       │
│  🔷 CodeOmniVis   Architecture Visualizer        [ZH/EN] [Refresh] │
├────────────────────────────────────────────────────────────────┤
│ TAB BAR                                                         │
│  [Graph ▼] [Filter] [Issues 3] [AI] [Stats]                    │
├──────┬─────────────────────────────────────┬───────────────────┤
│      │                                     │                   │
│SIDE  │        CANVAS                       │  DETAIL           │
│BAR   │   Cytoscape.js                      │  PANEL            │
│      │                                     │  (selected node)  │
│      │                                     │                   │
│      │                 [NodeTypeFilter]     │                   │
└──────┴─────────────────────────────────────┴───────────────────┘
```

### Tab 展开时（以 Filter Tab 为例）

```
┌────────────────────────────────────────────────────────────────┐
│ BRAND BAR                                                       │
├────────────────────────────────────────────────────────────────┤
│  [Graph] [Filter ▼] [Issues 3] [AI] [Stats]                    │
├────────────────────────────────────────────────────────────────┤
│ FILTER PANEL（从 Tab 下方滑入，不挤压 Canvas）                   │
│  节点类型: [📄 page ✓] [🧩 component ✓] [🔗 api_route ✓] ...  │
│  边类型:   [renders ✓] [calls_api ✓] [queries_db ✓] ...        │
│  置信度:   [● certain ✓] [○ inferred ✓]                        │
│  孤立节点: [显示孤立 ✓]                                         │
│                                      [重置] [应用]              │
├──────┬─────────────────────────────────────┬───────────────────┤
│      │        CANVAS（高度自适应）           │  DETAIL PANEL     │
└──────┴─────────────────────────────────────┴───────────────────┘
```

---

## 三、Tab 系统详细设计

### 3.1 Tab 定义

```typescript
// packages/ui/src/types/tabs.ts

export type TabId = 'graph' | 'filter' | 'issues' | 'ai' | 'stats'

export interface TabConfig {
  id: TabId
  labelKey: string      // i18n key
  emoji: string
  badgeCount?: number   // issues 用，显示红色数字
  panelComponent: React.ComponentType | null  // null = 无面板（graph tab）
}

export const TABS: TabConfig[] = [
  { id: 'graph',  labelKey: 'tab.graph',  emoji: '🗺️', panelComponent: null },
  { id: 'filter', labelKey: 'tab.filter', emoji: '🔍', panelComponent: FilterPanel },
  { id: 'issues', labelKey: 'tab.issues', emoji: '⚠️', panelComponent: IssuesPanel },
  { id: 'ai',     labelKey: 'tab.ai',     emoji: '🤖', panelComponent: AiPanel },
  { id: 'stats',  labelKey: 'tab.stats',  emoji: '📊', panelComponent: StatsPanel },
]
```

### 3.2 TabBar 组件

```typescript
// packages/ui/src/components/TabBar/TabBar.tsx

interface TabBarProps {
  activeTab: TabId | null
  onTabChange: (tab: TabId | null) => void
  issueBadgeCount: number
}

export function TabBar({ activeTab, onTabChange, issueBadgeCount }: TabBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center border-b border-slate-700 bg-slate-800 px-4">
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        const count = tab.id === 'issues' ? issueBadgeCount : undefined

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(isActive ? null : tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2.5 text-sm',
              'border-b-2 transition-colors',
              isActive
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
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
```

### 3.3 Tab Panel 动画（从上方滑入，不顶走 Canvas）

```typescript
// packages/ui/src/components/TabBar/TabPanel.tsx
// 使用 absolute 定位覆盖在 canvas 上方，不影响布局

export function TabPanel({ activeTab }: { activeTab: TabId | null }) {
  const PanelComponent = activeTab
    ? TABS.find(t => t.id === activeTab)?.panelComponent
    : null

  if (!PanelComponent) return null

  return (
    // absolute 覆盖，z-10 在 canvas 上方，不改变 canvas 高度
    <div className="absolute left-0 right-0 top-0 z-10 max-h-64 overflow-y-auto
                    border-b border-slate-600 bg-slate-800/95 backdrop-blur-sm
                    shadow-xl animate-slideDown">
      <PanelComponent />
    </div>
  )
}

// tailwind.config.ts 中添加动画：
// animation: { slideDown: 'slideDown 0.2s ease-out' }
// keyframes: { slideDown: { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }
```

---

## 四、筛选器重构

### 4.1 FilterPanel 组件（替代 NodeTypeFilter）

```typescript
// packages/ui/src/components/Filter/FilterPanel.tsx

import { NODE_COLORS, NODE_EMOJI } from '../../lib/nodeConfig'
import { EDGE_TYPE_LABELS } from '../../lib/edgeConfig'
import { useGraphFilter } from '../../hooks/useGraphFilter'
import { useTranslation } from 'react-i18next'

export function FilterPanel() {
  const { t } = useTranslation()
  const {
    nodeTypeFilter, toggleNodeType,
    edgeTypeFilter, toggleEdgeType,
    confidenceFilter, toggleConfidence,
    showIsolated, setShowIsolated,
    resetFilters,
  } = useGraphFilter()

  return (
    <div className="grid grid-cols-4 gap-4 p-4">

      {/* 节点类型 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.nodeTypes')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {NODE_TYPE_LIST.map(type => (
            <FilterChip
              key={type}
              active={nodeTypeFilter.has(type)}
              color={NODE_COLORS[type]}
              emoji={NODE_EMOJI[type]}
              label={t(`nodeType.${type}`)}
              onClick={() => toggleNodeType(type)}
            />
          ))}
        </div>
      </div>

      {/* 边类型 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.edgeTypes')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {EDGE_TYPE_LIST.map(type => (
            <FilterChip
              key={type}
              active={edgeTypeFilter.has(type)}
              label={t(`edgeType.${type}`)}
              onClick={() => toggleEdgeType(type)}
            />
          ))}
        </div>
      </div>

      {/* 置信度 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.confidence')}
        </h3>
        <div className="flex gap-1.5">
          {(['certain', 'inferred'] as const).map(c => (
            <FilterChip
              key={c}
              active={confidenceFilter.has(c)}
              label={t(`confidence.${c}`)}
              onClick={() => toggleConfidence(c)}
            />
          ))}
        </div>
      </div>

      {/* 其他 */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {t('filter.display')}
        </h3>
        <FilterChip
          active={showIsolated}
          label={t('filter.showIsolated')}
          onClick={() => setShowIsolated(!showIsolated)}
        />
        <button
          onClick={resetFilters}
          className="mt-2 w-full rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700"
        >
          {t('filter.reset')}
        </button>
      </div>

    </div>
  )
}
```

### 4.2 FilterChip 组件

```typescript
// packages/ui/src/components/Filter/FilterChip.tsx

interface FilterChipProps {
  active: boolean
  label: string
  emoji?: string
  color?: string
  onClick: () => void
}

export function FilterChip({ active, label, emoji, color, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all',
        active
          ? 'bg-slate-600 text-white ring-1 ring-slate-500'
          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
      )}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: active ? color : 'transparent',
                   border: `1px solid ${color}` }}
        />
      )}
      {emoji && <span>{emoji}</span>}
      <span className={active ? '' : 'line-through opacity-60'}>{label}</span>
    </button>
  )
}
```

### 4.3 useGraphFilter hook

```typescript
// packages/ui/src/hooks/useGraphFilter.ts

import { useCallback, useRef } from 'react'
import { useCytoscapeInstance } from './useCytoscapeInstance'
import { NodeType, EdgeType } from '@codeomnivis/shared'

interface GraphFilterState {
  nodeTypeFilter: Set<NodeType>
  edgeTypeFilter: Set<EdgeType>
  confidenceFilter: Set<'certain' | 'inferred'>
  showIsolated: boolean
}

// 默认全开
const DEFAULT_STATE: GraphFilterState = {
  nodeTypeFilter: new Set(NODE_TYPE_LIST),
  edgeTypeFilter: new Set(EDGE_TYPE_LIST),
  confidenceFilter: new Set(['certain', 'inferred']),
  showIsolated: true,
}

export function useGraphFilter() {
  const [state, setState] = useState<GraphFilterState>(DEFAULT_STATE)
  const cy = useCytoscapeInstance()

  // ── 关键：保存 viewport 的 ref ──────────────────
  const savedViewport = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null)

  const applyFilter = useCallback((newState: GraphFilterState) => {
    if (!cy) return

    // 1. 保存当前视口（首次筛选时保存）
    if (!savedViewport.current) {
      savedViewport.current = { pan: cy.pan(), zoom: cy.zoom() }
    }

    const currentPan = cy.pan()
    const currentZoom = cy.zoom()

    cy.batch(() => {
      // 节点类型过滤
      cy.nodes().forEach(node => {
        const type = node.data('type') as NodeType
        const hasEdges = node.degree() > 0
        const isIsolated = !hasEdges

        const typeVisible = newState.nodeTypeFilter.has(type)
        const isolatedVisible = newState.showIsolated || !isIsolated

        node.style('display', typeVisible && isolatedVisible ? 'element' : 'none')
      })

      // 边类型 + 置信度过滤
      cy.edges().forEach(edge => {
        const edgeType = edge.data('type') as EdgeType
        const confidence = edge.data('confidence') as 'certain' | 'inferred'

        const typeVisible = newState.edgeTypeFilter.has(edgeType)
        const confVisible = newState.confidenceFilter.has(confidence)

        edge.style('display', typeVisible && confVisible ? 'element' : 'none')
      })
    })

    // 2. 恢复视口（不 fit！）
    cy.viewport({ zoom: currentZoom, pan: currentPan })

  }, [cy])

  const toggleNodeType = useCallback((type: NodeType) => {
    setState(prev => {
      const next = { ...prev, nodeTypeFilter: new Set(prev.nodeTypeFilter) }
      next.nodeTypeFilter.has(type)
        ? next.nodeTypeFilter.delete(type)
        : next.nodeTypeFilter.add(type)
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const toggleEdgeType = useCallback((type: EdgeType) => {
    setState(prev => {
      const next = { ...prev, edgeTypeFilter: new Set(prev.edgeTypeFilter) }
      next.edgeTypeFilter.has(type)
        ? next.edgeTypeFilter.delete(type)
        : next.edgeTypeFilter.add(type)
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const toggleConfidence = useCallback((c: 'certain' | 'inferred') => {
    setState(prev => {
      const next = { ...prev, confidenceFilter: new Set(prev.confidenceFilter) }
      next.confidenceFilter.has(c)
        ? next.confidenceFilter.delete(c)
        : next.confidenceFilter.add(c)
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const setShowIsolated = useCallback((show: boolean) => {
    setState(prev => {
      const next = { ...prev, showIsolated: show }
      applyFilter(next)
      return next
    })
  }, [applyFilter])

  const resetFilters = useCallback(() => {
    setState(DEFAULT_STATE)
    applyFilter(DEFAULT_STATE)
    // 重置后恢复 fit
    if (cy) {
      cy.fit(undefined, 40)
      savedViewport.current = null
    }
  }, [applyFilter, cy])

  return {
    nodeTypeFilter: state.nodeTypeFilter,
    edgeTypeFilter: state.edgeTypeFilter,
    confidenceFilter: state.confidenceFilter,
    showIsolated: state.showIsolated,
    toggleNodeType,
    toggleEdgeType,
    toggleConfidence,
    setShowIsolated,
    resetFilters,
  }
}
```

---

## 五、节点 Emoji + Hover Tooltip

### 5.1 NodeConfig 配置表

```typescript
// packages/ui/src/lib/nodeConfig.ts

import type { NodeType } from '@codeomnivis/shared'

export const NODE_EMOJI: Record<NodeType, string> = {
  page:            '📄',
  component:       '🧩',
  api_route:       '🔗',
  trpc_procedure:  '⚡',
  express_route:   '🚂',
  handler:         '⚙️',
  service:         '🔧',
  db_model:        '🗄️',
  module:          '📦',
}

export const NODE_COLORS: Record<NodeType, string> = {
  page:            '#6366f1',
  component:       '#3b82f6',
  api_route:       '#10b981',
  trpc_procedure:  '#06b6d4',
  express_route:   '#f59e0b',
  handler:         '#f97316',
  service:         '#a78bfa',
  db_model:        '#ec4899',
  module:          '#6b7280',
}

export const NODE_TYPE_LIST = Object.keys(NODE_EMOJI) as NodeType[]
```

### 5.2 在 Cytoscape 节点中嵌入 Emoji

Cytoscape.js 的节点 label 支持直接渲染 emoji（SVG 文本）：

```typescript
// packages/ui/src/lib/cytoscapeConfig.ts
// 在现有 style 配置中修改 node 的 label

const cytoscapeStylesheet: cytoscape.Stylesheet[] = [
  {
    selector: 'node',
    style: {
      // 将 emoji 和节点名拼接为 label
      'label': (node: cytoscape.NodeSingular) => {
        const type = node.data('type') as NodeType
        const name = node.data('name') as string
        const emoji = NODE_EMOJI[type] ?? '●'
        // 截断长名称
        const displayName = name.length > 20 ? name.slice(0, 18) + '…' : name
        return `${emoji}\n${displayName}`
      },
      'text-wrap': 'wrap',
      'text-max-width': '80px',
      'font-size': '11px',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'background-color': (node: cytoscape.NodeSingular) => {
        const type = node.data('type') as NodeType
        return NODE_COLORS[type] ?? '#6b7280'
      },
      'width': 36,
      'height': 36,
    }
  },
  // inferred 边用虚线
  {
    selector: 'edge[confidence = "inferred"]',
    style: {
      'line-style': 'dashed',
      'line-dash-pattern': [6, 3],
      'opacity': 0.6,
    }
  },
]
```

### 5.3 NodeTooltip 组件

```typescript
// packages/ui/src/components/Graph/NodeTooltip.tsx

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI, NODE_COLORS } from '../../lib/nodeConfig'
import type { NodeType } from '@codeomnivis/shared'

interface TooltipData {
  x: number
  y: number
  nodeId: string
  type: NodeType
  name: string
  filePath: string
  line: number
  edgeCount: { in: number; out: number }
}

interface NodeTooltipProps {
  cyRef: React.RefObject<cytoscape.Core | null>
}

const HOVER_DELAY_MS = 600

export function NodeTooltip({ cyRef }: NodeTooltipProps) {
  const { t } = useTranslation()
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const onMouseOver = (evt: cytoscape.EventObject) => {
      const node = evt.target as cytoscape.NodeSingular
      const renderedPos = node.renderedPosition()
      const container = cy.container()
      const rect = container?.getBoundingClientRect()

      if (!rect) return

      timerRef.current = setTimeout(() => {
        setTooltip({
          // 屏幕坐标 = canvas 内坐标 + container 偏移
          x: rect.left + renderedPos.x,
          y: rect.top + renderedPos.y - 20,
          nodeId: node.id(),
          type: node.data('type') as NodeType,
          name: node.data('name') as string,
          filePath: node.data('filePath') as string ?? '',
          line: node.data('line') as number ?? 0,
          edgeCount: {
            in:  node.indegree(false),
            out: node.outdegree(false),
          },
        })
      }, HOVER_DELAY_MS)
    }

    const onMouseOut = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setTooltip(null)
    }

    // 点击节点时也隐藏 tooltip
    cy.on('tap', 'node', onMouseOut)
    cy.on('mouseover', 'node', onMouseOver)
    cy.on('mouseout',  'node', onMouseOut)

    return () => {
      cy.off('mouseover', 'node', onMouseOver)
      cy.off('mouseout',  'node', onMouseOut)
      cy.off('tap', 'node', onMouseOut)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [cyRef])

  if (!tooltip) return null

  const emoji = NODE_EMOJI[tooltip.type] ?? '●'
  const color = NODE_COLORS[tooltip.type] ?? '#6b7280'

  return (
    // fixed 定位，跟随鼠标位置
    <div
      className="fixed z-50 rounded-lg border border-slate-600 bg-slate-800
                 p-3 shadow-xl text-sm pointer-events-none
                 animate-fadeIn"
      style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}
    >
      {/* 节点类型行 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">{emoji}</span>
        <span className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: color }}>
          {t(`nodeType.${tooltip.type}`)}
        </span>
      </div>
      {/* 节点名称 */}
      <div className="font-medium text-white">{tooltip.name}</div>
      {/* 文件路径 */}
      {tooltip.filePath && (
        <div className="mt-1 text-xs text-slate-400 max-w-xs truncate">
          {tooltip.filePath}
          {tooltip.line > 0 && <span className="ml-1 text-slate-500">:{tooltip.line}</span>}
        </div>
      )}
      {/* 入度/出度 */}
      <div className="mt-1.5 flex gap-3 text-xs text-slate-400">
        <span>↙ {tooltip.edgeCount.in} {t('tooltip.in')}</span>
        <span>↗ {tooltip.edgeCount.out} {t('tooltip.out')}</span>
      </div>
    </div>
  )
}
```

---

## 六、i18n 实现

### 6.1 安装依赖

```bash
pnpm add react-i18next i18next --filter @codeomnivis/ui
```

### 6.2 初始化

```typescript
// packages/ui/src/lib/i18n.ts

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: localStorage.getItem('codeomnivis-lang') ?? 'en-US',
    fallbackLng: 'en-US',
    interpolation: { escapeValue: false },
  })

export default i18n
```

### 6.3 中文词条（zh-CN.json）

```json
{
  "tab.graph":   "图谱",
  "tab.filter":  "筛选",
  "tab.issues":  "问题",
  "tab.ai":      "AI",
  "tab.stats":   "统计",

  "filter.nodeTypes":    "节点类型",
  "filter.edgeTypes":    "边类型",
  "filter.confidence":   "置信度",
  "filter.display":      "显示选项",
  "filter.showIsolated": "显示孤立节点",
  "filter.reset":        "重置筛选",

  "nodeType.page":           "页面",
  "nodeType.component":      "组件",
  "nodeType.api_route":      "API 路由",
  "nodeType.trpc_procedure": "tRPC 接口",
  "nodeType.express_route":  "Express 路由",
  "nodeType.handler":        "Handler",
  "nodeType.service":        "Service",
  "nodeType.db_model":       "数据库模型",
  "nodeType.module":         "模块",

  "edgeType.renders":        "渲染",
  "edgeType.navigates_to":   "跳转",
  "edgeType.calls_api":      "调用 API",
  "edgeType.handles":        "处理",
  "edgeType.calls_service":  "调用 Service",
  "edgeType.queries_db":     "查询 DB",
  "edgeType.db_relation":    "数据库关系",
  "edgeType.imports":        "导入",
  "edgeType.contains":       "包含",

  "confidence.certain":  "确定",
  "confidence.inferred": "推断",

  "tooltip.in":  "条入边",
  "tooltip.out": "条出边",

  "header.refresh":   "刷新",
  "header.refreshing":"刷新中...",

  "detail.location":   "位置",
  "detail.upstream":   "上游",
  "detail.downstream": "下游",
  "detail.openVSCode": "在 VS Code 中打开",

  "issues.deadLink":      "死链 API 调用",
  "issues.unusedRoute":   "未使用的路由",
  "issues.methodMismatch":"HTTP Method 不匹配",
  "issues.isolated":      "孤立节点",

  "stats.nodes":   "节点",
  "stats.edges":   "边",
  "stats.isolated":"孤立节点",
  "stats.coverage":"连通率"
}
```

### 6.4 英文词条（en-US.json）

```json
{
  "tab.graph":   "Graph",
  "tab.filter":  "Filter",
  "tab.issues":  "Issues",
  "tab.ai":      "AI",
  "tab.stats":   "Stats",

  "filter.nodeTypes":    "Node Types",
  "filter.edgeTypes":    "Edge Types",
  "filter.confidence":   "Confidence",
  "filter.display":      "Display",
  "filter.showIsolated": "Show Isolated Nodes",
  "filter.reset":        "Reset Filters",

  "nodeType.page":           "Page",
  "nodeType.component":      "Component",
  "nodeType.api_route":      "API Route",
  "nodeType.trpc_procedure": "tRPC Procedure",
  "nodeType.express_route":  "Express Route",
  "nodeType.handler":        "Handler",
  "nodeType.service":        "Service",
  "nodeType.db_model":       "DB Model",
  "nodeType.module":         "Module",

  "edgeType.renders":        "Renders",
  "edgeType.navigates_to":   "Navigates To",
  "edgeType.calls_api":      "Calls API",
  "edgeType.handles":        "Handles",
  "edgeType.calls_service":  "Calls Service",
  "edgeType.queries_db":     "Queries DB",
  "edgeType.db_relation":    "DB Relation",
  "edgeType.imports":        "Imports",
  "edgeType.contains":       "Contains",

  "confidence.certain":  "Certain",
  "confidence.inferred": "Inferred",

  "tooltip.in":  "in",
  "tooltip.out": "out",

  "header.refresh":    "Refresh",
  "header.refreshing": "Refreshing...",

  "detail.location":   "Location",
  "detail.upstream":   "Upstream",
  "detail.downstream": "Downstream",
  "detail.openVSCode": "Open in VS Code",

  "issues.deadLink":       "Dead API Call",
  "issues.unusedRoute":    "Unused Route",
  "issues.methodMismatch": "HTTP Method Mismatch",
  "issues.isolated":       "Isolated Node",

  "stats.nodes":   "Nodes",
  "stats.edges":   "Edges",
  "stats.isolated":"Isolated",
  "stats.coverage":"Coverage"
}
```

### 6.5 语言切换按钮

```typescript
// packages/ui/src/components/Header/LangToggle.tsx

import { useTranslation } from 'react-i18next'

export function LangToggle() {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh-CN'

  const toggle = () => {
    const next = isZh ? 'en-US' : 'zh-CN'
    i18n.changeLanguage(next)
    localStorage.setItem('codeomnivis-lang', next)
  }

  return (
    <button
      onClick={toggle}
      className="rounded px-2 py-1 text-xs text-slate-400
                 hover:bg-slate-700 hover:text-white transition-colors"
    >
      {isZh ? '🌐 EN' : '🌐 中'}
    </button>
  )
}
```

---

## 七、修复刷新按钮

```typescript
// packages/ui/src/components/Header/Header.tsx
// 找到刷新按钮，接入 React Query 的 refetch

import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function Header() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // 1. 调用 /api/analyze 触发重新分析
      await fetch('/api/analyze', { method: 'POST' })
      // 2. 让 React Query 重新拉取图数据
      await queryClient.invalidateQueries({ queryKey: ['graph'] })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <header className="...">
      {/* ... 其他内容 ... */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="..."
      >
        {isRefreshing ? (
          <span className="animate-spin">⟳</span>
        ) : '↺'}
        <span className="ml-1 text-xs">
          {isRefreshing ? t('header.refreshing') : t('header.refresh')}
        </span>
      </button>
    </header>
  )
}
```

---

## 八、文件变更清单

### 新建文件

```
packages/ui/src/
├── types/
│   └── tabs.ts                          ← Tab 类型定义
├── lib/
│   ├── nodeConfig.ts                    ← NODE_EMOJI + NODE_COLORS
│   ├── edgeConfig.ts                    ← EDGE_TYPE_LIST + EDGE_TYPE_LABELS
│   └── i18n.ts                          ← i18n 初始化
├── locales/
│   ├── zh-CN.json                       ← 中文词条
│   └── en-US.json                       ← 英文词条
├── components/
│   ├── TabBar/
│   │   ├── TabBar.tsx                   ← Tab 栏
│   │   ├── TabPanel.tsx                 ← Tab 展开面板容器
│   │   ├── FilterPanel.tsx              ← 筛选面板
│   │   ├── IssuesPanel.tsx              ← 问题面板（复用 IssuePanel）
│   │   ├── StatsPanel.tsx               ← 统计面板
│   │   └── AiPanel.tsx                  ← AI 面板（Phase 3 占位）
│   ├── Filter/
│   │   └── FilterChip.tsx               ← 筛选 chip 组件
│   ├── Graph/
│   │   └── NodeTooltip.tsx              ← 节点悬停浮层
│   └── Header/
│       └── LangToggle.tsx               ← 语言切换按钮
└── hooks/
    └── useGraphFilter.ts                ← 筛选状态 + 视口保护
```

### 修改文件

```
packages/ui/src/
├── App.tsx                              ← 加入 TabBar + TabPanel，重构布局
├── components/Header/Header.tsx         ← 修复刷新按钮，加 LangToggle
├── components/Graph/GraphCanvas.tsx     ← 嵌入 NodeTooltip，更新 stylesheet
├── lib/cytoscapeConfig.ts               ← 节点 label 加 emoji，inferred 边虚线
└── main.tsx                             ← import i18n.ts
```

### 删除/废弃文件

```
packages/ui/src/
├── components/NodeTypeFilter.tsx        ← 功能迁移到 FilterPanel，可删除
└── hooks/useCytoscape.ts                ← 死代码，可删除
```

---

## 九、执行顺序与时间估算

| 顺序 | 任务 | 预估 | 备注 |
|------|------|------|------|
| 1 | 安装 react-i18next，创建词条文件，初始化 i18n | 1h | 最低风险，先做好 i18n 基础设施 |
| 2 | 创建 nodeConfig.ts（Emoji + 颜色映射） | 0.5h | 后续所有组件都依赖这个 |
| 3 | 修复刷新按钮事件 | 0.5h | 独立改动，不影响其他 |
| 4 | useGraphFilter hook（视口保护）| 2h | 核心逻辑，先写测试再实现 |
| 5 | FilterChip + FilterPanel | 1.5h | 依赖 Step 2 + 4 |
| 6 | NodeTooltip 组件 | 1.5h | 独立组件，风险低 |
| 7 | cytoscapeConfig 加 Emoji label + inferred 虚线 | 1h | 修改现有配置 |
| 8 | TabBar + TabPanel | 2h | UI 结构最大改动 |
| 9 | App.tsx 重构布局，整合所有新组件 | 2h | 最后整合 |
| 10 | LangToggle 集成到 Header | 0.5h | 最简单 |
| **合计** | | **~12h** | |

---

## 十、Claude Code 提示词

以下可直接粘贴使用。

---

### Prompt A：i18n 基础设施 + nodeConfig

```
你是 CodeOmniVis 项目的前端开发者。

执行顺序：

1. 在 packages/ui 中安装 react-i18next 和 i18next：
   pnpm add react-i18next i18next --filter @codeomnivis/ui

2. 创建 packages/ui/src/locales/zh-CN.json，内容如下：
[粘贴 6.3 节的 JSON]

3. 创建 packages/ui/src/locales/en-US.json，内容如下：
[粘贴 6.4 节的 JSON]

4. 创建 packages/ui/src/lib/i18n.ts：
[粘贴 6.2 节的代码]

5. 创建 packages/ui/src/lib/nodeConfig.ts：
[粘贴 5.1 节的代码]

6. 创建 packages/ui/src/lib/edgeConfig.ts，内容为：
import type { EdgeType } from '@codeomnivis/shared'
export const EDGE_TYPE_LIST: EdgeType[] = ['renders','navigates_to','calls_api','handles','calls_service','queries_db','db_relation','imports','contains']

7. 在 packages/ui/src/main.tsx 顶部加入：
import './lib/i18n'

8. 运行 pnpm build --filter @codeomnivis/ui，确认无 TypeScript 错误
```

---

### Prompt B：useGraphFilter hook + FilterPanel

```
你是 CodeOmniVis 项目的前端开发者。
i18n 和 nodeConfig 已完成（Prompt A 已执行）。

1. 读取 packages/ui/src/components/Graph/GraphCanvas.tsx，
   找到 Cytoscape 实例的存储方式（ref 或 state），
   确认如何在 hook 中访问它。

2. 创建 packages/ui/src/hooks/useGraphFilter.ts：
[粘贴 4.3 节的代码]
注意：将 useCytoscapeInstance() 替换为项目实际访问 cy 实例的方式。

3. 创建 packages/ui/src/components/Filter/FilterChip.tsx：
[粘贴 4.2 节的代码]

4. 创建 packages/ui/src/components/Filter/FilterPanel.tsx：
[粘贴 4.1 节的代码]

5. 运行 pnpm build --filter @codeomnivis/ui，确认无错误。

6. 临时在 App.tsx 底部渲染 <FilterPanel />，
   运行开发服务器截图确认 UI 渲染正确，再移除临时代码。
```

---

### Prompt C：NodeTooltip + Cytoscape Emoji

```
你是 CodeOmniVis 项目的前端开发者。

1. 读取 packages/ui/src/lib/cytoscapeConfig.ts 的完整内容。

2. 在现有的 node style 配置中：
   - 将 label 改为 emoji + 换行 + 节点名（截断 20 字）
   - 加入 text-wrap: wrap 和 text-max-width: 80px
   - background-color 改为从 NODE_COLORS 映射
   - 新增 inferred 边虚线样式
   参考 5.2 节的配置。

3. 创建 packages/ui/src/components/Graph/NodeTooltip.tsx：
[粘贴 5.3 节的代码]

4. 在 GraphCanvas.tsx 中：
   - 引入 NodeTooltip
   - 将 cy ref 传给 NodeTooltip：<NodeTooltip cyRef={cyRef} />

5. 运行开发服务器，悬停节点 600ms 后应显示浮层。
   截图确认。如果 tooltip 位置偏移，调整 left/top 的偏移值。
```

---

### Prompt D：TabBar + App.tsx 整合

```
你是 CodeOmniVis 项目的前端开发者。
前三个 Prompt 已执行完毕。

1. 读取 packages/ui/src/App.tsx 的完整内容。

2. 读取 packages/ui/src/components/Header/Header.tsx 的完整内容。

3. 创建以下文件（按顺序）：
   a. packages/ui/src/types/tabs.ts [粘贴 3.1 节代码]
   b. packages/ui/src/components/TabBar/TabBar.tsx [粘贴 3.2 节代码]
   c. packages/ui/src/components/TabBar/TabPanel.tsx [粘贴 3.3 节代码]
   d. packages/ui/src/components/Header/LangToggle.tsx [粘贴 6.5 节代码]
   e. packages/ui/src/components/TabBar/StatsPanel.tsx（简单占位：
      export function StatsPanel() { return <div className="p-4 text-slate-400">Stats coming soon</div> })
   f. packages/ui/src/components/TabBar/AiPanel.tsx（同上占位）

4. 修改 Header.tsx：
   - 修复刷新按钮事件 [粘贴 7 节代码]
   - 在右侧操作区加入 <LangToggle />

5. 修改 App.tsx：
   - 在 Header 和主内容区之间加入 <TabBar>
   - 在主内容区的 relative 容器内加入 <TabPanel>（absolute 覆盖，z-10）
   - 管理 activeTab state（useState<TabId | null>(null)）
   
   新的 App 结构：
   <div class="flex flex-col h-screen bg-slate-900">
     <Header />
     <TabBar activeTab={activeTab} onTabChange={setActiveTab} issueBadgeCount={issueCount} />
     <div class="flex flex-1 overflow-hidden relative">
       <TabPanel activeTab={activeTab} />   ← absolute 定位，z-10
       <Sidebar />
       <main class="flex-1 relative">
         <GraphCanvas />
         <NodeTypeFilter />   ← 可保留或删除（FilterPanel 已覆盖功能）
       </main>
       <NodeDetailPanel />
     </div>
   </div>

6. 运行 pnpm build，确认无错误。
7. 运行开发服务器，截图以下状态：
   - 默认状态（无 Tab 展开）
   - Filter Tab 展开后的面板
   - 悬停节点 tooltip
   - 中文切换后的界面
```

---

## 十一、后续扩展（本次不做）

AiPanel 的实现留到后续，当前用占位组件。接入 Claude API 后，AiPanel 的功能是：
- 用户选中孤立节点 → 自动把节点信息 + 源文件内容发给 AI → 显示诊断结果
- 用户手动输入问题 → AI 结合图数据回答
- 对 inferred 边做 AI 二次确认 → 提升或降低置信度

这些功能依赖 MCP 修复完成后，再在 AiPanel 中实现。

---

*文档版本：1.0 | 基于 CodeOmniVis 前端 DOM 结构 + 需求梳理*
