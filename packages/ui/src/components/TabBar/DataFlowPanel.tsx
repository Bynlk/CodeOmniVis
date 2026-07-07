import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getGraphDataflow, getGraphNodes } from '../../services'

async function fetchAllModels(): Promise<{ id: string; name: string }[]> {
  return getGraphNodes('db_model')
}

const SUBHEAD =
  'mb-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted'

export function DataFlowPanel() {
  const { t } = useTranslation()
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  const { data: models } = useQuery({
    queryKey: ['db-models'],
    queryFn: fetchAllModels,
  })

  const { data: flowResults, isLoading } = useQuery({
    queryKey: ['dataflow', selectedModel],
    queryFn: () => getGraphDataflow(selectedModel ?? undefined),
    enabled: selectedModel !== null,
  })

  const flow = flowResults?.[0]

  return (
    <div className="space-y-ds-4 p-ds-4">
      <p className="text-ds-xs text-content-muted">{t('dataflow.title')}</p>

      {/* Model 选择器 */}
      <div className="flex flex-wrap gap-ds-2">
        {(models ?? []).map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedModel(m.name)}
            className={`rounded-ds-md px-ds-3 py-1.5 text-ds-xs font-medium transition-colors ${
              selectedModel === m.name
                ? 'bg-pink-600 text-white'
                : 'bg-surface-hover text-content-secondary hover:bg-surface-overlay'
            }`}
          >
            🗄️ {m.name}
          </button>
        ))}
        {(!models || models.length === 0) && (
          <span className="text-ds-xs text-content-muted">{t('dataflow.noModels')}</span>
        )}
      </div>

      {/* 数据流路径 */}
      {isLoading && (
        <div className="text-ds-sm text-content-muted">{t('dataflow.tracing')}</div>
      )}

      {flow && (
        <div className="space-y-ds-3">
          {/* 概览 */}
          <div className="flex flex-wrap items-center gap-ds-2 rounded-ds-md bg-surface-hover/50 px-ds-3 py-ds-2 text-ds-sm">
            <span className="font-medium text-pink-400">🗄️ {flow.modelName}</span>
            <span className="text-content-muted">→</span>
            <span className="text-primary-400">{flow.totalRoutes} {t('dataflow.routes')}</span>
            <span className="text-content-muted">→</span>
            <span className="text-emerald-400">{flow.totalComponents} {t('dataflow.components')}</span>
          </div>

          {/* 路由列表 */}
          {flow.paths.map((path, idx) => (
            <div key={idx} className="space-y-ds-2">
              {path.apiNodes.length > 0 && (
                <div>
                  <div className={SUBHEAD}>{t('dataflow.apiRoutes')}</div>
                  <div className="space-y-1">
                    {path.apiNodes.map(node => (
                      <div
                        key={node.id}
                        className="flex items-center gap-ds-2 rounded-ds-sm bg-surface-hover/60 p-1.5 text-ds-xs"
                      >
                        <span>🔗</span>
                        <span className="truncate text-content-secondary">{node.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {path.componentNodes.length > 0 && (
                <div>
                  <div className={SUBHEAD}>{t('dataflow.consumingComponents')}</div>
                  <div className="space-y-1">
                    {path.componentNodes.map(node => (
                      <div
                        key={node.id}
                        className="flex items-center gap-ds-2 rounded-ds-sm bg-surface-hover/60 p-1.5 text-ds-xs"
                      >
                        <span>⚛️</span>
                        <span className="truncate text-content-secondary">{node.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {path.apiNodes.length === 0 && path.componentNodes.length === 0 && (
                <div className="text-ds-xs text-content-muted">{t('dataflow.noFlow')}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedModel && !isLoading && !flow && (
        <div className="text-ds-xs text-content-muted">{t('dataflow.noFlow')}</div>
      )}
    </div>
  )
}
