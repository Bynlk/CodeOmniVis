import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

interface DataFlowPath {
  modelNode: { id: string; name: string; type: string }
  apiNodes: { id: string; name: string; type: string }[]
  componentNodes: { id: string; name: string; type: string }[]
}

interface DataFlowResult {
  modelId: string
  modelName: string
  paths: DataFlowPath[]
  totalRoutes: number
  totalComponents: number
}

async function fetchDataFlow(model?: string): Promise<DataFlowResult[]> {
  const url = model
    ? `/api/graph/dataflow?model=${encodeURIComponent(model)}`
    : '/api/graph/dataflow'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch dataflow: ${res.statusText}`)
  const json = await res.json()
  // 处理 null/undefined 的情况
  if (!json.data) return []
  return Array.isArray(json.data) ? json.data : [json.data]
}

async function fetchAllModels(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('/api/graph/nodes?type=db_model')
  if (!res.ok) return []
  const json = await res.json()
  return (json.data ?? []).map((n: { id: string; name: string }) => ({ id: n.id, name: n.name }))
}

export function DataFlowPanel() {
  const { t } = useTranslation()
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  const { data: models } = useQuery({
    queryKey: ['db-models'],
    queryFn: fetchAllModels,
  })

  const { data: flowResults, isLoading } = useQuery({
    queryKey: ['dataflow', selectedModel],
    queryFn: () => fetchDataFlow(selectedModel ?? undefined),
    enabled: selectedModel !== null,
  })

  const flow = flowResults?.[0]

  return (
    <div className="p-4 space-y-4">
      <p className="text-slate-400 text-xs">{t('dataflow.title')}</p>

      {/* Model 选择器 */}
      <div className="flex flex-wrap gap-2">
        {(models ?? []).map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedModel(m.name)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedModel === m.name
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🗄️ {m.name}
          </button>
        ))}
        {(!models || models.length === 0) && (
          <span className="text-slate-500 text-xs">{t('dataflow.noModels')}</span>
        )}
      </div>

      {/* 数据流路径 */}
      {isLoading && (
        <div className="text-slate-400 text-sm">{t('dataflow.tracing')}</div>
      )}

      {flow && (
        <div className="space-y-3">
          {/* 概览 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-400 font-medium">🗄️ {flow.modelName}</span>
            <span className="text-slate-500">→</span>
            <span className="text-blue-400">{flow.totalRoutes} {t('dataflow.routes')}</span>
            <span className="text-slate-500">→</span>
            <span className="text-green-400">{flow.totalComponents} {t('dataflow.components')}</span>
          </div>

          {/* 路由列表 */}
          {flow.paths.map((path, idx) => (
            <div key={idx} className="space-y-2">
              {path.apiNodes.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                    {t('dataflow.apiRoutes')}
                  </div>
                  <div className="space-y-1">
                    {path.apiNodes.map(node => (
                      <div
                        key={node.id}
                        className="flex items-center gap-2 text-xs p-1.5 rounded bg-slate-700/50"
                      >
                        <span>🔗</span>
                        <span className="text-slate-300 truncate">{node.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {path.componentNodes.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                    {t('dataflow.consumingComponents')}
                  </div>
                  <div className="space-y-1">
                    {path.componentNodes.map(node => (
                      <div
                        key={node.id}
                        className="flex items-center gap-2 text-xs p-1.5 rounded bg-slate-700/50"
                      >
                        <span>⚛️</span>
                        <span className="text-slate-300 truncate">{node.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {path.apiNodes.length === 0 && path.componentNodes.length === 0 && (
                <div className="text-slate-500 text-xs">{t('dataflow.noFlow')}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedModel && !isLoading && !flow && (
        <div className="text-slate-500 text-xs">{t('dataflow.noFlow')}</div>
      )}
    </div>
  )
}
