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

export interface UiState {
  selectedNodeId: string | null
  activeTab: TabId | null
  searchQuery: string
  isCommandPaletteOpen: boolean
  isSettingsOpen: boolean
  isMobileDrawerOpen: boolean
}

export interface UiActions {
  selectNode: (id: string | null) => void
  setActiveTab: (tab: TabId | null) => void
  setSearchQuery: (query: string) => void
  toggleCommandPalette: (open?: boolean) => void
  toggleSettings: (open?: boolean) => void
  toggleMobileDrawer: (open?: boolean) => void
}

export type UiStore = UiState & UiActions

const initialState: UiState = {
  selectedNodeId: null,
  activeTab: null,
  searchQuery: '',
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  isMobileDrawerOpen: false,
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
  selectNode: (id) => setState({ selectedNodeId: id }),
  setActiveTab: (tab) => setState({ activeTab: tab }),
  setSearchQuery: (query) => setState({ searchQuery: query }),
  toggleCommandPalette: (open) =>
    setState({ isCommandPaletteOpen: open ?? !state.isCommandPaletteOpen }),
  toggleSettings: (open) => setState({ isSettingsOpen: open ?? !state.isSettingsOpen }),
  toggleMobileDrawer: (open) =>
    setState({ isMobileDrawerOpen: open ?? !state.isMobileDrawerOpen }),
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

/** 非 React 上下文读取当前快照(测试 / 命令式代码用)。 */
export function getUiState(): UiStore {
  return state
}

/** 测试辅助:重置到初始状态。 */
export function __resetUiStore(): void {
  setState({ ...initialState })
}
