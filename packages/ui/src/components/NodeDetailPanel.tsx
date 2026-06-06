import type { OmniNode, OmniEdge } from '@omnivis/shared'
import { NODE_COLORS } from '@omnivis/shared'
import { useTranslation } from 'react-i18next'

interface NodeDetailPanelProps {
  node: OmniNode | null
  inEdges: OmniEdge[]
  outEdges: OmniEdge[]
  onClose: () => void
  onNodeSelect: (nodeId: string) => void
}

export default function NodeDetailPanel({
  node,
  inEdges,
  outEdges,
  onClose,
  onNodeSelect,
}: NodeDetailPanelProps) {
  const { t } = useTranslation()

  if (!node) return null

  const color = NODE_COLORS[node.type] || '#94a3b8'

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-800 border-l border-slate-700 overflow-y-auto shadow-xl">
      {/* 头部 */}
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="font-semibold text-white truncate">{node.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label={t('detail.closePanel')}
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">{node.type}</p>
      </div>

      {/* 详细信息 */}
      <div className="p-4 space-y-4">
        {/* 文件位置 */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {t('detail.location')}
          </h4>
          <p className="text-sm text-slate-300">{node.filePath}</p>
          <p className="text-xs text-slate-500">{t('detail.line')} {node.line}</p>
        </div>

        {/* Metadata */}
        {node.metadata && Object.keys(node.metadata).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {t('detail.details')}
            </h4>
            <pre className="text-xs text-slate-300 bg-slate-900 p-2 rounded overflow-x-auto">
              {JSON.stringify(node.metadata, null, 2)}
            </pre>
          </div>
        )}

        {/* 入边（上游） */}
        {inEdges.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {t('detail.upstream')} ({inEdges.length})
            </h4>
            <ul className="space-y-1">
              {inEdges.map((edge) => (
                <li key={edge.id}>
                  <button
                    className="w-full text-left text-sm text-slate-300 hover:text-white hover:bg-slate-700 p-1 rounded transition-colors"
                    onClick={() => onNodeSelect(edge.source)}
                  >
                    {edge.source.split(':').pop()}
                    <span className="text-xs text-slate-500 ml-1">({edge.type})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 出边（下游） */}
        {outEdges.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {t('detail.downstream')} ({outEdges.length})
            </h4>
            <ul className="space-y-1">
              {outEdges.map((edge) => (
                <li key={edge.id}>
                  <button
                    className="w-full text-left text-sm text-slate-300 hover:text-white hover:bg-slate-700 p-1 rounded transition-colors"
                    onClick={() => onNodeSelect(edge.target)}
                  >
                    {edge.target.split(':').pop()}
                    <span className="text-xs text-slate-500 ml-1">({edge.type})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 打开源码按钮 */}
        <button
          className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors"
          onClick={() => {
            // 尝试用 vscode:// 协议打开
            const vscodeUrl = `vscode://file/${node.filePath}:${node.line}`
            window.open(vscodeUrl, '_blank')
          }}
        >
          {t('detail.openVSCode')}
        </button>
      </div>
    </div>
  )
}
