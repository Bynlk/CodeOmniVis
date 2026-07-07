import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { type ChatMessage, type TraceResult } from '@codeomnivis/shared'
import { postAiExplain } from '../../services'
import { useSelectedNode } from '../../lib/selectionContext'
import { useTrace } from '../../hooks/useTrace'
import { useCytoscapeInstance } from '../../lib/cytoscapeContext'
import { loadAiConfig } from '../../lib/aiConfig'
import { TraceStepCard } from './TraceStepCard'
import { TraceRunner } from './TraceRunner'

const STATION_INTERVAL_MS = 1000

/** 把链路结果拼成可读的链路说明请求（供 AI 富化）。 */
function buildLinkPrompt(trace: TraceResult): string {
  const lines = trace.steps.map(
    s => `${s.index}. [${s.layer}] ${s.nodeName} (${s.nodeType}) @ ${s.filePath}:${s.line} — ${s.explanation}`,
  )
  return `下面是一条代码调用链路(从上游到下游),请用 2-3 句话概括它的业务含义与数据走向:\n${lines.join('\n')}`
}

export function TracePanel() {
  const { t } = useTranslation()
  const selectedNode = useSelectedNode()
  const cy = useCytoscapeInstance()
  const { data: trace, isLoading } = useTrace(selectedNode)

  const [activeIndex, setActiveIndex] = useState(-1)
  const [running, setRunning] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 选中节点变化 → 重置动画状态
  useEffect(() => {
    stopTimer()
    setRunning(false)
    setActiveIndex(-1)
    setAiSummary(null)
  }, [selectedNode, stopTimer])

  useEffect(() => () => stopTimer(), [stopTimer])

  const totalSteps = trace?.totalSteps ?? 0

  const runTrace = useCallback(() => {
    if (trace === undefined || trace.steps.length === 0) return
    stopTimer()
    setActiveIndex(0)
    setRunning(true)
    timerRef.current = setInterval(() => {
      setActiveIndex(prev => {
        const next = prev + 1
        if (next >= trace.steps.length) {
          stopTimer()
          setRunning(false)
          return trace.steps.length - 1
        }
        return next
      })
    }, STATION_INTERVAL_MS)
  }, [trace, stopTimer])

  const stopTrace = useCallback(() => {
    stopTimer()
    setRunning(false)
  }, [stopTimer])

  // 选中站点 → 在图谱上聚焦
  const focusNode = useCallback((nodeId: string) => {
    if (cy === null) return
    const node = cy.getElementById(nodeId)
    if (node.length > 0) cy.animate({ center: { eles: node }, zoom: 1.4, duration: 300 })
  }, [cy])

  const explainWithAi = useCallback(async () => {
    if (trace === undefined || trace.steps.length === 0) return
    const config = loadAiConfig()
    setAiLoading(true)
    setAiSummary(null)
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是资深架构师,擅长用简洁中文解释代码调用链路。' },
        { role: 'user', content: buildLinkPrompt(trace) },
      ]
      const body = config === null ? { messages } : { messages, config }
      const result = await postAiExplain(body)
      if (result.ok) {
        setAiSummary(result.content ?? t('ai.noResponse'))
      } else {
        setAiSummary(t('ai.serviceUnavailable'))
      }
    } catch {
      setAiSummary(t('ai.serviceUnavailable'))
    } finally {
      setAiLoading(false)
    }
  }, [trace, t])

  return (
    <div className="space-y-ds-3 p-ds-4">
      <TraceRunner steps={trace?.steps ?? []} activeIndex={activeIndex} />

      <div className="flex items-center justify-between">
        <p className="text-ds-xs text-content-muted">{t('trace.title')}</p>
        {totalSteps > 0 && (
          <span className="text-[10px] text-content-muted">{t('trace.totalStations', { count: totalSteps })}</span>
        )}
      </div>

      {selectedNode === null && (
        <div className="text-ds-xs text-content-muted">{t('trace.selectNode')}</div>
      )}

      {selectedNode !== null && isLoading && (
        <div className="text-ds-xs text-content-muted">{t('trace.running')}</div>
      )}

      {selectedNode !== null && !isLoading && totalSteps === 0 && (
        <div className="text-ds-xs text-content-muted">{t('trace.noPath')}</div>
      )}

      {trace !== undefined && totalSteps > 0 && (
        <>
          <div className="flex items-center gap-ds-2">
            <button
              type="button"
              onClick={running ? stopTrace : runTrace}
              className="rounded-ds-md bg-amber-600 px-ds-3 py-1.5 text-ds-xs font-medium text-white transition-colors hover:bg-amber-500"
            >
              {running ? t('trace.stop') : activeIndex >= 0 ? t('trace.replay') : t('trace.run')}
            </button>
            <button
              type="button"
              onClick={() => void explainWithAi()}
              disabled={aiLoading}
              className="rounded-ds-md border border-border-subtle bg-surface-hover px-ds-3 py-1.5 text-ds-xs font-medium text-content-secondary transition-colors hover:bg-surface-overlay disabled:opacity-50"
            >
              🤖 {aiLoading ? t('trace.explaining') : t('trace.colExplain')}
            </button>
          </div>

          {aiSummary !== null && (
            <div className="rounded-ds-md border border-border-subtle bg-surface px-ds-3 py-ds-2 text-ds-xs leading-relaxed text-content-secondary">
              {aiSummary}
            </div>
          )}

          <div className="space-y-1.5">
            {trace.steps.map((step, i) => (
              <TraceStepCard
                key={step.nodeId}
                step={step}
                active={i === activeIndex}
                onSelect={focusNode}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
