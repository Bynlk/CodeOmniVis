import { useMemo, useRef, useCallback, useEffect } from 'react'
import type cytoscape from 'cytoscape'
import { useTranslation } from 'react-i18next'
import GraphCanvas from './components/GraphCanvas'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import NodeDetailPanel from './components/NodeDetailPanel'
import { TabBar } from './components/TabBar/TabBar'
import { TabPanel } from './components/TabBar/TabPanel'
import { CommandPalette } from './components/CommandPalette'
import { SettingsDrawer } from './components/SettingsDrawer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Legend } from './components/Legend'
import { CytoscapeContext } from './lib/cytoscapeContext'
import { SelectionContext } from './lib/selectionContext'
import { useGraph } from './hooks/useGraph'
import { useWebSocket } from './hooks/useWebSocket'
import { useUiStore } from './store/uiStore'
import { filterNodesByQuery } from './lib/searchNodes'

function App() {
  const { t } = useTranslation()

  // UI 状态统一来自 store(feature-002 状态分层),不再散落 useState。
  const selectedNode = useUiStore((s) => s.selectedNodeId)
  const activeTab = useUiStore((s) => s.activeTab)
  const searchQuery = useUiStore((s) => s.searchQuery)
  const isCommandPaletteOpen = useUiStore((s) => s.isCommandPaletteOpen)
  const isSettingsOpen = useUiStore((s) => s.isSettingsOpen)
  const selectNode = useUiStore((s) => s.selectNode)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const setSearchQuery = useUiStore((s) => s.setSearchQuery)
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette)
  const toggleSettings = useUiStore((s) => s.toggleSettings)

  const cyRef = useRef<cytoscape.Core | null>(null)
  const { data: graph, isLoading, error } = useGraph()

  // 搜索结果 → 可见节点 id 集合(E-12/F16)。无搜索词时为 undefined,Sidebar 显示全部。
  const visibleNodeIds = useMemo<Set<string> | undefined>(() => {
    if (!searchQuery.trim() || !graph) return undefined
    return new Set(filterNodesByQuery(graph.nodes, searchQuery).map(n => n.id))
  }, [searchQuery, graph])

  // WebSocket 实时更新
  useWebSocket({ enabled: true })

  // Cmd+K 打开命令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCommandPalette])

  const handleCyInit = useCallback((cy: cytoscape.Core) => {
    cyRef.current = cy
  }, [])

  // 命令面板选择节点
  const handleCommandSelect = useCallback((nodeId: string) => {
    selectNode(nodeId)
    // 聚焦到选中节点
    const cy = cyRef.current
    if (cy) {
      const node = cy.getElementById(nodeId)
      if (node.length > 0) {
        cy.animate({ center: { eles: node }, zoom: 1.5, duration: 300 })
      }
    }
  }, [selectNode])

  // 获取选中节点的详细信息
  const selectedNodeData = useMemo(() => {
    if (!graph || !selectedNode) return null
    return graph.nodes.find(n => n.id === selectedNode) || null
  }, [graph, selectedNode])

  // 获取入边和出边
  const inEdges = useMemo(() => {
    if (!graph || !selectedNode) return []
    return graph.edges.filter(e => e.target === selectedNode)
  }, [graph, selectedNode])

  const outEdges = useMemo(() => {
    if (!graph || !selectedNode) return []
    return graph.edges.filter(e => e.source === selectedNode)
  }, [graph, selectedNode])

  return (
    <ErrorBoundary>
    <CytoscapeContext.Provider value={cyRef}>
      <SelectionContext.Provider value={selectedNode}>
      <div className="flex flex-col h-screen bg-slate-900">
        {/* 命令面板 */}
        <CommandPalette
          graph={graph}
          isOpen={isCommandPaletteOpen}
          onClose={() => toggleCommandPalette(false)}
          onNodeSelect={handleCommandSelect}
        />

        {/* 设置抽屉 */}
        <SettingsDrawer open={isSettingsOpen} onClose={() => toggleSettings(false)} />

        {/* 顶部导航栏 */}
        <Header query={searchQuery} onQueryChange={setSearchQuery} onOpenSettings={() => toggleSettings(true)} />

        {/* 顶层分组导航(≤4 组) */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          issueBadgeCount={0}
        />

        {/* 主内容区域 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧边栏 — 始终显示 */}
          <Sidebar
            graph={graph}
            selectedNode={selectedNode}
            onNodeSelect={selectNode}
            visibleNodeIds={visibleNodeIds}
          />

          {/* 中央画布区(常驻,面板打开时收窄而非被盖) */}
          <main className="flex-1 relative min-w-0">
            {/* 常驻图例（feature-003）—— 画布左下角,配色与画布单一真源一致 */}
            {!isLoading && !error && <Legend graph={graph} />}

            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400">{t('app.loadingGraph')}</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-400">{t('app.errorLoadingGraph')} {error.message}</div>
              </div>
            ) : (
              <GraphCanvas
                graph={graph}
                selectedNode={selectedNode}
                onNodeSelect={selectNode}
                onCyInit={handleCyInit}
              />
            )}
          </main>

          {/* 分析/工具 dock 面板(独立栅格轨道,不覆盖画布) */}
          <TabPanel activeTab={activeTab} onTabChange={setActiveTab} />

          {/* 右侧详情面板 */}
          {selectedNodeData && (
            <NodeDetailPanel
              node={selectedNodeData}
              inEdges={inEdges}
              outEdges={outEdges}
              onClose={() => selectNode(null)}
              onNodeSelect={selectNode}
            />
          )}
        </div>
      </div>
      </SelectionContext.Provider>
    </CytoscapeContext.Provider>
    </ErrorBoundary>
  )
}

export default App
