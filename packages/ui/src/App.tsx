import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type cytoscape from 'cytoscape'
import GraphCanvas from './components/GraphCanvas'
import Header from './components/Header'
import NodeDetailPanel from './components/NodeDetailPanel'
import { CommandPalette } from './components/CommandPalette'
import { SettingsDrawer } from './components/SettingsDrawer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { WorkbenchShell } from './components/Workbench/WorkbenchShell'
import { ViewRail } from './components/Workbench/ViewRail'
import { ExplorerPanel } from './components/Workbench/ExplorerPanel'
import { CanvasHeader } from './components/Workbench/CanvasHeader'
import { QualityCanvas } from './components/Workbench/QualityCanvas'
import { StatusBar } from './components/Workbench/StatusBar'
import { CanvasEmptyState } from './components/Workbench/CanvasEmptyState'
import { CanvasErrorState } from './components/Workbench/CanvasErrorState'
import { QualityExplorer } from './components/Workbench/QualityExplorer'
import { TestExplorer } from './components/Workbench/TestExplorer'
import { TestCanvas } from './components/Workbench/TestCanvas'
import { CytoscapeContext } from './lib/cytoscapeContext'
import { SelectionContext } from './lib/selectionContext'
import { useGraph } from './hooks/useGraph'
import { useGraphErrors } from './hooks/useGraphErrors'
import { useGraphIssues } from './hooks/useGraphIssues'
import { useStatus } from './hooks/useStatus'
import { useProject } from './hooks/useProject'
import { useWebSocket } from './hooks/useWebSocket'
import { useUiStore } from './store/uiStore'
import { filterGraphByVisibleNodeIds, selectVisibleNodeIds } from './lib/searchNodes'
import { deriveWorkbenchGraph } from './lib/workbenchViews'
import { mergeQualityFindings } from './lib/qualityFindings'
import type { ArchitectureDepth, WorkbenchView } from './types/workbench'

function GraphLoadingState() {
  const { t } = useTranslation()
  return (
    <div className="h-full p-5" aria-label={t('workbench.loadingGraph', 'Building architecture index…')}>
      <div className="relative h-full overflow-hidden rounded-md border border-border-subtle bg-[#090b0f]">
        <div className="absolute left-[18%] top-[22%] h-10 w-28 animate-pulse rounded-md border border-border-subtle bg-surface" />
        <div className="absolute left-[46%] top-[43%] h-10 w-32 animate-pulse rounded-md border border-border-subtle bg-surface" />
        <div className="absolute bottom-[20%] right-[16%] h-10 w-28 animate-pulse rounded-md border border-border-subtle bg-surface" />
        <p className="absolute bottom-4 left-4 font-mono text-[10px] text-content-muted">{t('workbench.loadingGraph', 'Building architecture index…')}</p>
      </div>
    </div>
  )
}

function App() {
  const selectedNodeId = useUiStore(state => state.selectedNodeId)
  const searchQuery = useUiStore(state => state.searchQuery)
  const activeView = useUiStore(state => state.activeView)
  const architectureDepth = useUiStore(state => state.architectureDepth)
  const isCommandPaletteOpen = useUiStore(state => state.isCommandPaletteOpen)
  const isSettingsOpen = useUiStore(state => state.isSettingsOpen)
  const isMobileDrawerOpen = useUiStore(state => state.isMobileDrawerOpen)
  const selectNode = useUiStore(state => state.selectNode)
  const setSearchQuery = useUiStore(state => state.setSearchQuery)
  const setActiveView = useUiStore(state => state.setActiveView)
  const setArchitectureDepth = useUiStore(state => state.setArchitectureDepth)
  const toggleCommandPalette = useUiStore(state => state.toggleCommandPalette)
  const toggleSettings = useUiStore(state => state.toggleSettings)
  const toggleMobileDrawer = useUiStore(state => state.toggleMobileDrawer)

  const cyRef = useRef<cytoscape.Core | null>(null)
  const { data: graph, isLoading, error } = useGraph()
  const { data: graphErrors, isLoading: errorsLoading, error: errorsError } = useGraphErrors()
  const { data: graphIssues, isLoading: issuesLoading, error: issuesError } = useGraphIssues()
  const { data: status } = useStatus()
  const { data: project } = useProject()
  const isAnalyzed = Boolean(status.lastAnalyzedAt) || Boolean(graph?.nodes.length)
  const qualityFindings = useMemo(
    () => mergeQualityFindings(graphErrors, graphIssues?.issues),
    [graphErrors, graphIssues?.issues],
  )

  useWebSocket({ enabled: true })

  const viewGraph = useMemo(() => {
    if (!graph) return undefined
    return deriveWorkbenchGraph(graph, {
      view: activeView,
      depth: activeView === 'architecture' ? architectureDepth : 'full',
      focusNodeId: selectedNodeId,
      searchQuery,
    })
  }, [graph, activeView, architectureDepth, selectedNodeId, searchQuery])

  const visibleNodeIds = useMemo(
    () => selectVisibleNodeIds(viewGraph?.nodes, searchQuery),
    [viewGraph?.nodes, searchQuery],
  )
  const visibleGraph = useMemo(
    () => filterGraphByVisibleNodeIds(viewGraph, visibleNodeIds),
    [viewGraph, visibleNodeIds],
  )

  const selectedNode = useMemo(
    () => graph?.nodes.find(node => node.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  )
  const inEdges = useMemo(
    () => graph?.edges.filter(edge => edge.target === selectedNodeId) ?? [],
    [graph, selectedNodeId],
  )
  const outEdges = useMemo(
    () => graph?.edges.filter(edge => edge.source === selectedNodeId) ?? [],
    [graph, selectedNodeId],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggleCommandPalette()
      }
      if ((event.metaKey || event.ctrlKey) && ['1', '2', '3', '4', '5'].includes(event.key)) {
        event.preventDefault()
        const views: WorkbenchView[] = ['architecture', 'requests', 'data', 'tests', 'quality']
        setActiveView(views[Number(event.key) - 1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveView, toggleCommandPalette])

  const handleCyInit = useCallback((cy: cytoscape.Core) => { cyRef.current = cy }, [])
  const handleFit = useCallback(() => { cyRef.current?.fit(undefined, 48) }, [])
  const handleCommandSelect = useCallback((nodeId: string) => {
    selectNode(nodeId)
    const node = cyRef.current?.getElementById(nodeId)
    if (node?.length) cyRef.current?.animate({ center: { eles: node }, zoom: 1.35, duration: 180 })
  }, [selectNode])
  const handleDepthChange = useCallback((depth: ArchitectureDepth) => {
    if (depth === 'focus' && !selectedNodeId) return
    setArchitectureDepth(depth)
  }, [selectedNodeId, setArchitectureDepth])
  const handleNodeFocus = useCallback((nodeId: string) => {
    selectNode(nodeId)
    setArchitectureDepth('focus')
  }, [selectNode, setArchitectureDepth])
  const handleCanvasNodeSelect = useCallback((nodeId: string | null) => {
    selectNode(nodeId)
    if (!nodeId && architectureDepth === 'focus') setArchitectureDepth('full')
  }, [architectureDepth, selectNode, setArchitectureDepth])
  const handleExplorerNodeSelect = useCallback((nodeId: string) => {
    selectNode(nodeId)
    toggleMobileDrawer(false)
  }, [selectNode, toggleMobileDrawer])

  const canvas = (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasHeader view={activeView} graph={visibleGraph} depth={architectureDepth} focusAvailable={Boolean(selectedNodeId)} findingCount={qualityFindings.length} onDepthChange={handleDepthChange} onFit={handleFit} />
      <div className="relative min-h-0 flex-1">
        {activeView === 'quality' ? (
          <QualityCanvas
            findings={qualityFindings}
            isLoading={errorsLoading || issuesLoading}
            detectors={graphIssues?.detectors}
            parserError={errorsError}
            issuesError={issuesError}
            projectRoot={project?.projectRoot}
          />
        ) : isLoading ? (
          <GraphLoadingState />
        ) : error ? (
          <CanvasErrorState view={activeView} error={error} />
        ) : visibleGraph && visibleGraph.nodes.length > 0 ? (
          activeView === 'tests'
            ? <TestCanvas graph={visibleGraph}><GraphCanvas graph={visibleGraph} selectedNode={selectedNodeId} onNodeSelect={handleCanvasNodeSelect} onNodeFocus={handleNodeFocus} onCyInit={handleCyInit} /></TestCanvas>
            : <GraphCanvas graph={visibleGraph} selectedNode={selectedNodeId} onNodeSelect={handleCanvasNodeSelect} onNodeFocus={handleNodeFocus} onCyInit={handleCyInit} />
        ) : (
          <CanvasEmptyState view={activeView} hasSearchQuery={Boolean(searchQuery.trim())} isAnalyzed={isAnalyzed} />
        )}
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <CytoscapeContext.Provider value={cyRef}>
        <SelectionContext.Provider value={selectedNodeId}>
          <CommandPalette graph={graph} isOpen={isCommandPaletteOpen} onClose={() => toggleCommandPalette(false)} onNodeSelect={handleCommandSelect} />
          <SettingsDrawer open={isSettingsOpen} onClose={() => toggleSettings(false)} />
          <WorkbenchShell
            commandBar={<Header query={searchQuery} onQueryChange={setSearchQuery} onOpenSettings={() => toggleSettings(true)} />}
            viewRail={<ViewRail activeView={activeView} onViewChange={setActiveView} issueCount={qualityFindings.length} />}
            explorer={activeView === 'quality'
              ? <QualityExplorer
                  findings={qualityFindings}
                  isLoading={errorsLoading || issuesLoading}
                  detectors={graphIssues?.detectors}
                  parserError={errorsError}
                  issuesError={issuesError}
                />
              : activeView === 'tests'
                ? <TestExplorer graph={graph} selectedNodeId={selectedNodeId} onNodeSelect={handleExplorerNodeSelect} />
                : <ExplorerPanel graph={visibleGraph} view={activeView} isAnalyzed={isAnalyzed} selectedNodeId={selectedNodeId} onNodeSelect={handleExplorerNodeSelect} />}
            main={canvas}
            inspector={selectedNode ? <NodeDetailPanel node={selectedNode} projectRoot={project?.projectRoot} inEdges={inEdges} outEdges={outEdges} onClose={() => handleCanvasNodeSelect(null)} onNodeSelect={selectNode} /> : undefined}
            statusBar={<StatusBar status={status} nodeCount={graph?.nodes.length ?? 0} edgeCount={graph?.edges.length ?? 0} />}
            mobileExplorerOpen={isMobileDrawerOpen}
            onCloseMobileExplorer={() => toggleMobileDrawer(false)}
          />
        </SelectionContext.Provider>
      </CytoscapeContext.Provider>
    </ErrorBoundary>
  )
}

export default App
