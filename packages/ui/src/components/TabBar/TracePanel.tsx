import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isJsonObject, type ChatMessage, type TraceResult } from '@codeomnivis/shared'
import { readString } from '../../utils/readString'
import { useSelectedNode } from '../../lib/selectionContext'
import { useTrace } from '../../hooks/useTrace'
import { useCytoscapeInstance } from '../../lib/cytoscapeContext'
import { loadAiConfig } from '../../lib/aiConfig'
import { TraceStepCard } from './TraceStepCard'
import { TraceRunner } from './TraceRunner'

const STATION_INTERVAL_MS = 1000

/** 把链路结果拼成可读的链路说明请求(供 AI 富化)。 */
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
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const payload: unknown = await res.json()
        const data = isJsonObject(payload) ? payload.data : undefined
        setAiSummary(readString(data, 'content') ?? t('ai.noResponse'))
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
    <div className="p-4 space-y-3">
      <TraceRunner steps={trace?.steps ?? []} activeIndex={activeIndex} />

      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs">{t('trace.title')}</p>
        {totalSteps > 0 && (
          <span className="text-[10px] text-slate-500">{t('trace.totalStations', { count: totalSteps })}</span>
        )}
      </div>

      {selectedNode === null && (
        <div className="text-slate-500 text-xs">{t('trace.selectNode')}</div>
      )}

      {selectedNode !== null && isLoading && (
        <div className="text-slate-400 text-xs">{t('trace.running')}</div>
      )}

      {selectedNode !== null && !isLoading && totalSteps === 0 && (
        <div className="text-slate-500 text-xs">{t('trace.noPath')}</div>
      )}

      {trace !== undefined && totalSteps > 0 && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={running ? stopTrace : runTrace}
              className="px-3 py-1.5 rounded text-xs font-medium bg-amber-600 text-white hover:bg-amber-500 transition-colors"
            >
              {running ? t('trace.stop') : activeIndex >= 0 ? t('trace.replay') : t('trace.run')}
            </button>
            <button
              type="button"
              onClick={() => void explainWithAi()}
              disabled={aiLoading}
              className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              🤖 {aiLoading ? t('trace.explaining') : t('trace.colExplain')}
            </button>
          </div>

          {aiSummary !== null && (
            <div className="rounded bg-slate-900/60 border border-slate-700 px-3 py-2 text-xs text-slate-300 leading-relaxed">
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
