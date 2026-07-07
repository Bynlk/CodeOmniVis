import { useMemo, useRef, useCallback, useEffect } from 'react'
import type cytoscape from 'cytoscape'
import { useTranslation } from 'react-i18next'
import GraphCanvas from './components/GraphCanvas'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import NodeDetailPanel from './components/NodeDetailPanel'
import { AppShell } from './components/AppShell'
import { TabBar } from './components/TabBar/TabBar'
import { TabPanel } from './components/TabBar/TabPanel'
import { CommandPalette } from './components/CommandPalette'
import { SettingsDrawer } from './components/SettingsDrawer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Legend } from './components/Legend'
import { StatsHud } from './components/StatsHud'
import { CytoscapeContext } from './lib/cytoscapeContext'
import { SelectionContext } from './lib/selectionContext'
import { useGraph } from './hooks/useGraph'
import { useGraphErrors } from './hooks/useGraphErrors'
import { useWebSocket } from './hooks/useWebSocket'
import { useUiStore } from './store/uiStore'
import { selectVisibleNodeIds } from './lib/searchNodes'

/**
 * feature-011:App 降为纯布局编排 + 接线。
 * - 不持有业务 useState:UI 状态统一来自 uiStore,服务端状态来自 React Query。
 * - 布局结构下放到 AppShell,本组件只负责订阅状态 + 组装区域。
 */
function App() {
  const { t } = useTranslation()

  // UI 状态统一来自 store(状态分层),不散落 useState。
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
  // 问题 tab 徽标数量 = 真实解析错误数,替换硬编码 0。
  const { data: graphErrors } = useGraphErrors()
  const issueBadgeCount = graphErrors?.length ?? 0

  // 搜索结果 → 可见节点 id 集合(单一真源 selector)。无搜索词时为 undefined。
  const visibleNodeIds = useMemo<Set<string> | undefined>(
    () => selectVisibleNodeIds(graph?.nodes, searchQuery),
    [searchQuery, graph],
  )

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

  // 命令面板选择节点 → 选中 + 聚焦定位
  const handleCommandSelect = useCallback((nodeId: string) => {
    selectNode(nodeId)
    const cy = cyRef.current
    if (cy) {
      const node = cy.getElementById(nodeId)
      if (node.length > 0) {
        cy.animate({ center: { eles: node }, zoom: 1.5, duration: 300 })
      }
    }
  }, [selectNode])

  // 选中节点的详细信息 + 入/出边
  const selectedNodeData = useMemo(() => {
    if (!graph || !selectedNode) return null
    return graph.nodes.find((n) => n.id === selectedNode) || null
  }, [graph, selectedNode])

  const inEdges = useMemo(() => {
    if (!graph || !selectedNode) return []
    return graph.edges.filter((e) => e.target === selectedNode)
  }, [graph, selectedNode])

  const outEdges = useMemo(() => {
    if (!graph || !selectedNode) return []
    return graph.edges.filter((e) => e.source === selectedNode)
  }, [graph, selectedNode])

  // 右轨(分析 dock / 详情面板)是否占位。二者由 uiStore 保证互斥,至多一个占用。
  const isRightTrackOpen = Boolean(activeTab) || Boolean(selectedNodeData)

  return (
    <ErrorBoundary>
      <CytoscapeContext.Provider value={cyRef}>
        <SelectionContext.Provider value={selectedNode}>
          <AppShell
            skipToMainLabel={t('a11y.skipToMain')}
            isRightTrackOpen={isRightTrackOpen}
            overlays={
              <>
                <CommandPalette
                  graph={graph}
                  isOpen={isCommandPaletteOpen}
                  onClose={() => toggleCommandPalette(false)}
                  onNodeSelect={handleCommandSelect}
                />
                <SettingsDrawer open={isSettingsOpen} onClose={() => toggleSettings(false)} />
              </>
            }
            header={
              <Header
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onOpenSettings={() => toggleSettings(true)}
              />
            }
            tabBar={
              <TabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                issueBadgeCount={issueBadgeCount}
              />
            }
            sidebar={
              <Sidebar
                graph={graph}
                selectedNode={selectedNode}
                onNodeSelect={selectNode}
                visibleNodeIds={visibleNodeIds}
              />
            }
            main={
              <main
                id="main-content"
                tabIndex={-1}
                className="relative min-w-0 overflow-hidden bg-surface"
              >
                {!isLoading && !error && <Legend graph={graph} />}
                {!isLoading && !error && <StatsHud />}

                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col items-center gap-ds-3 text-content-muted">
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-primary-400" />
                      <span className="text-ds-sm">{t('app.loadingGraph')}</span>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex h-full items-center justify-center px-ds-6">
                    <div className="max-w-md rounded-ds-lg border border-rose-500/40 bg-rose-500/10 px-ds-5 py-ds-4 text-center text-rose-200">
                      <p className="text-ds-sm font-medium">{t('app.errorLoadingGraph')}</p>
                      <p className="mt-ds-1 text-ds-xs text-rose-300/80">{error.message}</p>
                    </div>
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
            }
            rightRegion={
              <>
                <TabPanel activeTab={activeTab} onTabChange={setActiveTab} />
                {selectedNodeData && (
                  <NodeDetailPanel
                    node={selectedNodeData}
                    inEdges={inEdges}
                    outEdges={outEdges}
                    onClose={() => selectNode(null)}
                    onNodeSelect={selectNode}
                  />
                )}
              </>
            }
          />
        </SelectionContext.Provider>
      </CytoscapeContext.Provider>
    </ErrorBoundary>
  )
}

export default App
