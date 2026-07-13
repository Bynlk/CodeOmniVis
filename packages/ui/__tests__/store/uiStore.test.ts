import { describe, it, expect, beforeEach } from 'vitest'
import { getUiState, __resetUiStore, selectIsAnyModalOpen } from '../../src/store/uiStore'

describe('uiStore actions', () => {
  beforeEach(() => {
    __resetUiStore()
  })

  it('initial state is clean', () => {
    const s = getUiState()
    expect(s.selectedNodeId).toBeNull()
    expect(s.activeTab).toBeNull()
    expect(s.searchQuery).toBe('')
    expect(s.isCommandPaletteOpen).toBe(false)
    expect(s.isSettingsOpen).toBe(false)
    expect(s.isMobileDrawerOpen).toBe(false)
  })

  it('selectNode updates selectedNodeId', () => {
    getUiState().selectNode('node-1')
    expect(getUiState().selectedNodeId).toBe('node-1')
    getUiState().selectNode(null)
    expect(getUiState().selectedNodeId).toBeNull()
  })

  it('setActiveTab updates activeTab', () => {
    getUiState().setActiveTab('issues')
    expect(getUiState().activeTab).toBe('issues')
  })

  it('setSearchQuery updates searchQuery', () => {
    getUiState().setSearchQuery('user')
    expect(getUiState().searchQuery).toBe('user')
  })

  it('leaving architecture focus resets the depth before returning', () => {
    getUiState().selectNode('node-1')
    getUiState().setArchitectureDepth('focus')

    getUiState().setActiveView('requests')
    getUiState().setActiveView('architecture')

    expect(getUiState().selectedNodeId).toBeNull()
    expect(getUiState().architectureDepth).toBe('overview')
  })

  it('toggleCommandPalette flips without arg, sets with arg', () => {
    getUiState().toggleCommandPalette()
    expect(getUiState().isCommandPaletteOpen).toBe(true)
    getUiState().toggleCommandPalette()
    expect(getUiState().isCommandPaletteOpen).toBe(false)
    getUiState().toggleCommandPalette(true)
    expect(getUiState().isCommandPaletteOpen).toBe(true)
  })

  it('toggleSettings and toggleMobileDrawer honor explicit arg', () => {
    getUiState().toggleSettings(true)
    expect(getUiState().isSettingsOpen).toBe(true)
    getUiState().toggleMobileDrawer(true)
    expect(getUiState().isMobileDrawerOpen).toBe(true)
    getUiState().toggleMobileDrawer(false)
    expect(getUiState().isMobileDrawerOpen).toBe(false)
  })

  it('setState identity: no change keeps same reference', () => {
    const before = getUiState()
    getUiState().selectNode(null) // already null
    expect(getUiState()).toBe(before)
  })

  it('state reference changes on actual update', () => {
    const before = getUiState()
    getUiState().selectNode('x')
    expect(getUiState()).not.toBe(before)
  })
})

describe('feature-010 布局仲裁:右轨互斥', () => {
  beforeEach(() => {
    __resetUiStore()
  })

  it('打开详情(selectNode)会关闭分析 dock(activeTab→null)', () => {
    getUiState().setActiveTab('filter')
    expect(getUiState().activeTab).toBe('filter')
    getUiState().selectNode('node-1')
    expect(getUiState().selectedNodeId).toBe('node-1')
    expect(getUiState().activeTab).toBeNull()
  })

  it('打开分析 dock(setActiveTab)会关闭详情(selectedNodeId→null)', () => {
    getUiState().selectNode('node-1')
    expect(getUiState().selectedNodeId).toBe('node-1')
    getUiState().setActiveTab('filter')
    expect(getUiState().activeTab).toBe('filter')
    expect(getUiState().selectedNodeId).toBeNull()
  })

  it('关闭详情(selectNode(null))不会误清 activeTab', () => {
    getUiState().setActiveTab('filter')
    getUiState().selectNode(null)
    expect(getUiState().activeTab).toBe('filter')
  })
})

describe('feature-010 布局仲裁:模态级浮层互斥', () => {
  beforeEach(() => {
    __resetUiStore()
  })

  it('打开命令面板会收起设置与移动抽屉', () => {
    getUiState().toggleSettings(true)
    getUiState().toggleMobileDrawer(true)
    // 上一步 toggleMobileDrawer 已互斥关掉 settings
    getUiState().toggleCommandPalette(true)
    expect(getUiState().isCommandPaletteOpen).toBe(true)
    expect(getUiState().isSettingsOpen).toBe(false)
    expect(getUiState().isMobileDrawerOpen).toBe(false)
  })

  it('打开设置会收起命令面板', () => {
    getUiState().toggleCommandPalette(true)
    getUiState().toggleSettings(true)
    expect(getUiState().isSettingsOpen).toBe(true)
    expect(getUiState().isCommandPaletteOpen).toBe(false)
  })

  it('同一时刻至多一个模态级浮层持有', () => {
    getUiState().toggleCommandPalette(true)
    getUiState().toggleSettings(true)
    getUiState().toggleMobileDrawer(true)
    const s = getUiState()
    const openCount = [s.isCommandPaletteOpen, s.isSettingsOpen, s.isMobileDrawerOpen].filter(Boolean).length
    expect(openCount).toBe(1)
  })

  it('selectIsAnyModalOpen 反映命令面板/设置状态', () => {
    expect(selectIsAnyModalOpen(getUiState())).toBe(false)
    getUiState().toggleCommandPalette(true)
    expect(selectIsAnyModalOpen(getUiState())).toBe(true)
    getUiState().toggleCommandPalette(false)
    expect(selectIsAnyModalOpen(getUiState())).toBe(false)
    getUiState().toggleSettings(true)
    expect(selectIsAnyModalOpen(getUiState())).toBe(true)
  })
})
