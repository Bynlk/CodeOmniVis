import type { NodeType } from '@omnivis/shared'
import { NODE_COLORS } from '@omnivis/shared'

interface NodeTypeFilterProps {
  activeTypes: Set<NodeType>
  onToggle: (type: NodeType) => void
  nodeCounts: Record<string, number>
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  page: 'Pages',
  component: 'Components',
  api_route: 'API Routes',
  trpc_procedure: 'tRPC',
  express_route: 'Express',
  handler: 'Handlers',
  service: 'Services',
  db_model: 'DB Models',
  module: 'Modules',
}

export default function NodeTypeFilter({
  activeTypes,
  onToggle,
  nodeCounts,
}: NodeTypeFilterProps) {
  const types = Object.keys(NODE_COLORS) as NodeType[]

  return (
    <div className="absolute bottom-4 left-4 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Node Types
      </h3>
      <div className="space-y-1">
        {types.map((type) => {
          const isActive = activeTypes.has(type)
          const count = nodeCounts[type] || 0

          return (
            <button
              key={type}
              className={`flex items-center space-x-2 w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                isActive
                  ? 'text-white hover:bg-slate-700'
                  : 'text-slate-500 hover:bg-slate-700'
              }`}
              onClick={() => onToggle(type)}
            >
              <div
                className={`w-3 h-3 rounded-full ${isActive ? '' : 'opacity-30'}`}
                style={{ backgroundColor: NODE_COLORS[type] }}
              />
              <span className={isActive ? '' : 'line-through'}>
                {NODE_TYPE_LABELS[type]}
              </span>
              <span className="text-xs text-slate-500 ml-auto">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
