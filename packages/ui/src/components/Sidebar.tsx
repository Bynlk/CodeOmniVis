import type { OmniGraph, OmniNode, NodeType } from '@omnivis/shared'
import { NODE_COLORS } from '@omnivis/shared'

interface SidebarProps {
  graph?: OmniGraph
  selectedNode: string | null
  onNodeSelect: (nodeId: string | null) => void
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  page: 'Pages',
  component: 'Components',
  api_route: 'API Routes',
  trpc_procedure: 'tRPC Procedures',
  express_route: 'Express Routes',
  handler: 'Handlers',
  service: 'Services',
  db_model: 'DB Models',
  module: 'Modules',
}

export default function Sidebar({ graph, selectedNode, onNodeSelect }: SidebarProps) {
  // 按类型分组节点
  const nodesByType = graph?.nodes.reduce((acc, node) => {
    if (!acc[node.type]) {
      acc[node.type] = []
    }
    acc[node.type].push(node)
    return acc
  }, {} as Record<NodeType, OmniNode[]>) || {}

  const nodeTypes = Object.keys(nodesByType) as NodeType[]

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Nodes ({graph?.nodes.length || 0})
        </h2>

        {nodeTypes.length === 0 ? (
          <p className="text-slate-500 text-sm">No nodes found</p>
        ) : (
          <div className="space-y-4">
            {nodeTypes.map((type) => (
              <div key={type}>
                <div className="flex items-center space-x-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: NODE_COLORS[type] }}
                  />
                  <h3 className="text-sm font-medium text-slate-300">
                    {NODE_TYPE_LABELS[type]}
                  </h3>
                  <span className="text-xs text-slate-500">
                    ({nodesByType[type].length})
                  </span>
                </div>

                <ul className="space-y-1 ml-5">
                  {nodesByType[type].map((node) => (
                    <li key={node.id}>
                      <button
                        className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                          selectedNode === node.id
                            ? 'bg-primary-600 text-white'
                            : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                        onClick={() => onNodeSelect(node.id)}
                        title={node.filePath}
                      >
                        {node.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
