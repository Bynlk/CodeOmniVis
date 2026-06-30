import { useTranslation } from 'react-i18next'
import type { TraceStep, TraceLayer } from '@codeomnivis/shared'
import { NODE_EMOJI } from '../../lib/nodeConfig'

/** 边类型 → 经由动词(展示用,与后端 EDGE_VERB 同义,缺省回退原值)。 */
const EDGE_LABEL: Record<string, string> = {
  renders: '渲染',
  navigates_to: '跳转',
  calls_api: '调用接口',
  handles: '处理',
  calls_service: '调用服务',
  queries_db: '查询数据',
  data_flows_to: '数据流向',
  sends_msg: '发送消息',
  listens_msg: '监听消息',
  imports: '引用',
  contains: '包含',
}

const LAYER_ACCENT: Record<TraceLayer, string> = {
  frontend: 'border-l-sky-400',
  api: 'border-l-violet-400',
  logic: 'border-l-amber-400',
  data: 'border-l-pink-400',
  other: 'border-l-slate-400',
}

interface TraceStepCardProps {
  step: TraceStep
  active: boolean
  onSelect: (nodeId: string) => void
}

/** 单个链路站点卡片:第 N 站 + 三列(节点 / 经由 / 说明)。 */
export function TraceStepCard({ step, active, onSelect }: TraceStepCardProps) {
  const { t } = useTranslation()
  const emoji = NODE_EMOJI[step.nodeType] ?? '●'
  const viaLabel =
    step.edgeFromPrev === null
      ? '—'
      : EDGE_LABEL[step.edgeFromPrev] ?? step.edgeFromPrev

  return (
    <button
      type="button"
      onClick={() => onSelect(step.nodeId)}
      className={`w-full text-left rounded border-l-4 ${LAYER_ACCENT[step.layer]} px-3 py-2 transition-colors ${
        active ? 'bg-amber-900/40 ring-1 ring-amber-500/60' : 'bg-slate-700/40 hover:bg-slate-700/70'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          {t('trace.station', { n: step.index })}
        </span>
        <span className="text-[10px] text-slate-400">
          {t(`trace.layer.${step.layer}`)}
        </span>
      </div>

      <div className="grid grid-cols-[1.2fr_0.8fr_2fr] gap-2 items-start text-xs">
        {/* 节点列 */}
        <div className="min-w-0">
          <div className="text-[9px] uppercase text-slate-500">{t('trace.colNode')}</div>
          <div className="flex items-center gap-1 text-slate-200 truncate" title={step.nodeName}>
            <span>{emoji}</span>
            <span className="truncate">{step.nodeName}</span>
          </div>
          <div className="text-[9px] text-slate-500 truncate" title={`${step.filePath}:${step.line}`}>
            {step.filePath.split('/').pop()}:{step.line}
          </div>
        </div>

        {/* 经由列 */}
        <div className="min-w-0">
          <div className="text-[9px] uppercase text-slate-500">{t('trace.colVia')}</div>
          <div className="text-slate-300 truncate" title={viaLabel}>{viaLabel}</div>
        </div>

        {/* 说明列 */}
        <div className="min-w-0">
          <div className="text-[9px] uppercase text-slate-500">{t('trace.colExplain')}</div>
          <div className="text-slate-400 leading-snug">{step.explanation}</div>
        </div>
      </div>
    </button>
  )
}
