import { describe, it, expect, beforeEach } from 'vitest'
import { getUiState, __resetUiStore } from '../../src/store/uiStore'

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
