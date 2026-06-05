import { useState, useMemo } from 'react'
import GraphCanvas from './components/GraphCanvas'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import NodeDetailPanel from './components/NodeDetailPanel'
import NodeTypeFilter from './components/NodeTypeFilter'
import { useGraph } from './hooks/useGraph'
import { useSearch } from './hooks/useSearch'
import type { NodeType } from '@omnivis/shared'

function App() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const { data: graph, isLoading, error } = useGraph()
  const { query, setQuery, filteredNodes, activeTypes, toggleType } = useSearch({ graph })

  // 计算节点类型计数
  const nodeCounts = useMemo(() => {
    if (!graph) return {}
    const counts: Record<string, number> = {}
    for (const node of graph.nodes) {
      counts[node.type] = (counts[node.type] || 0) + 1
    }
    return counts
  }, [graph])

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
    <div className="flex flex-col h-screen bg-slate-900">
      {/* 顶部导航栏 */}
      <Header query={query} onQueryChange={setQuery} />

      {/* 主内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧边栏 */}
        <Sidebar
          graph={graph}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
        />

        {/* 图可视化区域 */}
        <main className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400">Loading graph...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400">Error loading graph: {error.message}</div>
            </div>
          ) : (
            <>
              <GraphCanvas
                graph={graph}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
              />

              {/* 节点类型过滤器 */}
              <NodeTypeFilter
                activeTypes={activeTypes}
                onToggle={toggleType}
                nodeCounts={nodeCounts}
              />
            </>
          )}
        </main>

        {/* 右侧详情面板 */}
        {selectedNodeData && (
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
  )
}

export default App
