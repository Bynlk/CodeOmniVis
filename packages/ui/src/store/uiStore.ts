import { useSyncExternalStore } from 'react'
import type { TabId } from '../types/tabs'

/**
 * UI 状态集中管理(feature-002 状态分层)。
 *
 * 分层约定:
 * - 服务器状态 → React Query(useGraph/useStatus 等),不进本 store。
 * - Cytoscape 实例 → CytoscapeContext + cyRef,不进本 store。
 * - UI 状态(选中节点 / 激活 tab / 搜索词 / 各类抽屉开关)→ 本 store。
 *
 * 实现说明:项目未引入 zustand,这里用模块级 external store + useSyncExternalStore
 * 复刻 zustand 的 `useUiStore(selector)` 接口(无需 Provider 嵌套、支持切片订阅)。
 * 若后续引入 zustand,可原样替换而不改调用方。
 */

/** WebSocket 连接状态(feature-006):connected=绿 / reconnecting=黄 / connecting=灰。 */
export type WsStatus = 'connecting' | 'connected' | 'reconnecting'

export interface UiState {
  selectedNodeId: string | null
  activeTab: TabId | null
  searchQuery: string
  isCommandPaletteOpen: boolean
  isSettingsOpen: boolean
  isMobileDrawerOpen: boolean
  isLegendCollapsed: boolean
  wsStatus: WsStatus
}

export interface UiActions {
  selectNode: (id: string | null) => void
  setActiveTab: (tab: TabId | null) => void
  setSearchQuery: (query: string) => void
  toggleCommandPalette: (open?: boolean) => void
  toggleSettings: (open?: boolean) => void
  toggleMobileDrawer: (open?: boolean) => void
  toggleLegend: (collapsed?: boolean) => void
  setWsStatus: (status: WsStatus) => void
}

export type UiStore = UiState & UiActions

const LEGEND_STORAGE_KEY = 'codeomnivis-legend-collapsed'

function readLegendCollapsed(): boolean {
  try {
    return localStorage.getItem(LEGEND_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const initialState: UiState = {
  selectedNodeId: null,
  activeTab: null,
  searchQuery: '',
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  isMobileDrawerOpen: false,
  isLegendCollapsed: readLegendCollapsed(),
  wsStatus: 'connecting',
}

let state: UiStore
const listeners = new Set<() => void>()

function setState(patch: Partial<UiState>): void {
  // 仅在有实际变化时更新引用,避免无意义的重渲染
  let changed = false
  for (const key of Object.keys(patch) as (keyof UiState)[]) {
    if (state[key] !== patch[key]) {
      changed = true
      break
    }
  }
  if (!changed) return
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

state = {
  ...initialState,
  // feature-010 布局仲裁:打开详情(id 非 null)时收起分析 dock,右轨互斥。
  selectNode: (id) => setState(id ? { selectedNodeId: id, activeTab: null } : { selectedNodeId: id }),
  // feature-010 布局仲裁:打开分析 dock(tab 非 null)时关闭详情,右轨互斥。
  setActiveTab: (tab) => setState(tab ? { activeTab: tab, selectedNodeId: null } : { activeTab: tab }),
  setSearchQuery: (query) => setState({ searchQuery: query }),
  // feature-010 布局仲裁:三个模态级浮层(命令面板/设置/移动抽屉)互斥,
  // 打开任一时自动收起其余,保证同一时刻至多一个模态级浮层持有遮罩+焦点。
  toggleCommandPalette: (open) => {
    const next = open ?? !state.isCommandPaletteOpen
    setState(next
      ? { isCommandPaletteOpen: true, isSettingsOpen: false, isMobileDrawerOpen: false }
      : { isCommandPaletteOpen: false })
  },
  toggleSettings: (open) => {
    const next = open ?? !state.isSettingsOpen
    setState(next
      ? { isSettingsOpen: true, isCommandPaletteOpen: false, isMobileDrawerOpen: false }
      : { isSettingsOpen: false })
  },
  toggleMobileDrawer: (open) => {
    const next = open ?? !state.isMobileDrawerOpen
    setState(next
      ? { isMobileDrawerOpen: true, isCommandPaletteOpen: false, isSettingsOpen: false }
      : { isMobileDrawerOpen: false })
  },
  setWsStatus: (status) => setState({ wsStatus: status }),
  toggleLegend: (collapsed) => {
    const next = collapsed ?? !state.isLegendCollapsed
    try {
      localStorage.setItem(LEGEND_STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* ignore persistence failure */
    }
    setState({ isLegendCollapsed: next })
  },
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): UiStore {
  return state
}

/**
 * 订阅 UI store 的一个切片。用法与 zustand 一致:
 *   const activeTab = useUiStore((s) => s.activeTab)
 *   const selectNode = useUiStore((s) => s.selectNode)
 */
export function useUiStore<T>(selector: (store: UiStore) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  )
}

/**
 * feature-010:是否有模态级浮层(命令面板 / 设置)打开。
 * NodeTooltip 用它在模态期间抑制自身,避免 tooltip 盖在模态之上(AC4 双保险)。
 */
export function selectIsAnyModalOpen(store: UiStore): boolean {
  return store.isCommandPaletteOpen || store.isSettingsOpen
}

/** 非 React 上下文读取当前快照(测试 / 命令式代码用)。 */
export function getUiState(): UiStore {
  return state
}

/** 测试辅助:重置到初始状态。 */
export function __resetUiStore(): void {
  setState({ ...initialState, isLegendCollapsed: false, wsStatus: 'connecting' })
}
