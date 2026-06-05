import { useState } from 'react'
import GraphCanvas from './components/GraphCanvas'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import { useGraph } from './hooks/useGraph'

function App() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const { data: graph, isLoading, error } = useGraph()

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* 顶部导航栏 */}
      <Header />

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
            <GraphCanvas
              graph={graph}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
