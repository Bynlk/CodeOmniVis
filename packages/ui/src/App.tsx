import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type cytoscape from 'cytoscape'
import { useTranslation } from 'react-i18next'
import GraphCanvas from './components/GraphCanvas'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import NodeDetailPanel from './components/NodeDetailPanel'
import { TabBar } from './components/TabBar/TabBar'
import { TabPanel } from './components/TabBar/TabPanel'
import { FilterPanel } from './components/Filter/FilterPanel'
import { IssuesPanel } from './components/TabBar/IssuesPanel'
import { AiPanel } from './components/TabBar/AiPanel'
import { StatsPanel } from './components/TabBar/StatsPanel'
import { DataFlowPanel } from './components/TabBar/DataFlowPanel'
import { CommandPalette } from './components/CommandPalette'
import { CytoscapeContext } from './lib/cytoscapeContext'
import { useGraph } from './hooks/useGraph'
import { useSearch } from './hooks/useSearch'
import { useWebSocket } from './hooks/useWebSocket'
import type { TabId, TabConfig } from './types/tabs'

const TABS: TabConfig[] = [
  { id: 'graph',    labelKey: 'tab.graph',    emoji: '🗺️', panelComponent: null },
  { id: 'filter',   labelKey: 'tab.filter',   emoji: '🔍', panelComponent: FilterPanel },
  { id: 'issues',   labelKey: 'tab.issues',   emoji: '⚠️', panelComponent: IssuesPanel },
  { id: 'dataflow', labelKey: 'tab.dataflow', emoji: '🌊', panelComponent: DataFlowPanel },
  { id: 'ai',       labelKey: 'tab.ai',       emoji: '🤖', panelComponent: AiPanel },
  { id: 'stats',    labelKey: 'tab.stats',    emoji: '📊', panelComponent: StatsPanel },
]

function App() {
  const { t } = useTranslation()
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const { data: graph, isLoading, error } = useGraph()
  const { query, setQuery } = useSearch({ graph })

  // WebSocket 实时更新
  useWebSocket({ enabled: true })

  // Cmd+K 打开命令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCyInit = useCallback((cy: cytoscape.Core) => {
    cyRef.current = cy
  }, [])

  // 命令面板选择节点
  const handleCommandSelect = useCallback((nodeId: string) => {
    setSelectedNode(nodeId)
    // 聚焦到选中节点
    const cy = cyRef.current
    if (cy) {
      const node = cy.getElementById(nodeId)
      if (node.length > 0) {
        cy.animate({ center: { eles: node }, zoom: 1.5, duration: 300 })
      }
    }
  }, [])

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
    <CytoscapeContext.Provider value={cyRef}>
      <div className="flex flex-col h-screen bg-slate-900">
        {/* 命令面板 */}
        <CommandPalette
          graph={graph}
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNodeSelect={handleCommandSelect}
        />

        {/* 顶部导航栏 */}
        <Header query={query} onQueryChange={setQuery} />

        {/* Tab 栏 */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          issueBadgeCount={0}
          tabs={TABS}
        />

        {/* 主内容区域 */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Tab 面板（absolute 覆盖，不挤压 canvas） */}
          <TabPanel activeTab={activeTab} tabs={TABS} />

          {/* 左侧边栏 — 仅图谱 Tab 显示 */}
          {(!activeTab || activeTab === 'graph') && (
            <Sidebar
              graph={graph}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
            />
          )}

          {/* 图可视化区域 */}
          <main className="flex-1 relative">
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
                onNodeSelect={setSelectedNode}
                onCyInit={handleCyInit}
              />
            )}
          </main>

          {/* 右侧详情面板 — 仅图谱 Tab 显示 */}
          {(!activeTab || activeTab === 'graph') && selectedNodeData && (
            <NodeDetailPanel
              node={selectedNodeData}
              inEdges={inEdges}
              outEdges={outEdges}
              onClose={() => setSelectedNode(null)}
              onNodeSelect={setSelectedNode}
            />
          )}
        </div>
      </div>
    </CytoscapeContext.Provider>
  )
}

export default App
