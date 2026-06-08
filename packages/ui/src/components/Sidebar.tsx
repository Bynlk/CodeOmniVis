import { useMemo, useState } from 'react'
import type { OmniGraph, OmniNode, NodeType } from '@codeomnivis/shared'
import { NODE_COLORS } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'

interface SidebarProps {
  graph?: OmniGraph
  selectedNode: string | null
  onNodeSelect: (nodeId: string | null) => void
}

export default function Sidebar({ graph, selectedNode, onNodeSelect }: SidebarProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  // 按类型分组节点
  const nodesByType = useMemo(() => {
    return graph?.nodes.reduce((acc, node) => {
      if (!acc[node.type]) {
        acc[node.type] = []
      }
      acc[node.type].push(node)
      return acc
    }, {} as Record<NodeType, OmniNode[]>) || {}
  }, [graph?.nodes])

  const nodeTypes = useMemo(() => Object.keys(nodesByType) as NodeType[], [nodesByType])

  if (collapsed) {
    return (
      <aside className="w-10 bg-slate-800 border-r border-slate-700 flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
          title="展开侧边栏"
        >
          ▶
        </button>
        <div className="mt-3 flex flex-col items-center gap-1">
          {nodeTypes.slice(0, 8).map(type => (
            <div
              key={type}
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: NODE_COLORS[type] }}
              title={`${t(`nodeType.${type}`)} (${nodesByType[type].length})`}
            />
          ))}
          {nodeTypes.length > 8 && (
            <span className="text-[10px] text-slate-500">+{nodeTypes.length - 8}</span>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto shrink-0">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            {t('sidebar.nodes')} ({graph?.nodes.length || 0})
          </h2>
          <button
            onClick={() => setCollapsed(true)}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
            title="收起侧边栏"
          >
            ◀
          </button>
        </div>

        {nodeTypes.length === 0 ? (
          <p className="text-slate-500 text-sm">{t('sidebar.noNodesFound')}</p>
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
                    {t(`nodeType.${type}`)}
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
