import type { OmniNode, OmniEdge } from '@codeomnivis/shared'
import { NODE_COLORS } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI } from '../lib/nodeConfig'

interface NodeDetailPanelProps {
  node: OmniNode | null
  inEdges: OmniEdge[]
  outEdges: OmniEdge[]
  onClose: () => void
  onNodeSelect: (nodeId: string) => void
}

/** 小标题(分区标题) —— 统一样式。 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-ds-2 text-ds-xs font-semibold uppercase tracking-wider text-content-muted">
      {children}
    </h4>
  )
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
  const emoji = NODE_EMOJI[node.type] ?? '●'

  const renderEdgeList = (edges: OmniEdge[], pick: (e: OmniEdge) => string) => (
    <ul className="space-y-0.5">
      {edges.map((edge) => (
        <li key={edge.id}>
          <button
            className="flex w-full items-center justify-between gap-ds-2 rounded-ds-md px-ds-2 py-1.5 text-left text-ds-sm text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
            onClick={() => onNodeSelect(pick(edge))}
          >
            <span className="truncate">{pick(edge).split(':').pop()}</span>
            <span className="shrink-0 rounded-ds-sm bg-surface px-1.5 text-ds-xs text-content-muted">
              {edge.type}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {/* 移动端遮罪(<md):点击关闭。桌面进栅格轨道,无遮罪。 */}
      <div
        className="fixed inset-0 z-drawer bg-black/60 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 移动端 <md 为 fixed 抽屉;桌面 md:static 进入主区 CSS Grid 右轨,与分析 dock 互斥占用同一轨道。 */}
      <div
        className="fixed inset-y-0 right-0 z-drawer flex w-full max-w-sm flex-col overflow-hidden border-l border-border-subtle bg-surface-raised shadow-ds-panel md:static md:z-auto md:h-full md:w-80 md:max-w-none md:shrink-0 md:shadow-none"
        role="complementary"
      >
        {/* 头部 */}
        <div className="shrink-0 border-b border-border-subtle p-ds-4">
          <div className="flex items-start justify-between gap-ds-2">
            <div className="flex min-w-0 items-center gap-ds-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ds-md text-ds-sm"
                style={{ backgroundColor: `${color}33` }}
                aria-hidden="true"
              >
                {emoji}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-content">{node.name}</h3>
                <p className="flex items-center gap-1.5 text-ds-xs text-content-muted">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  {t(`nodeType.${node.type}`)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ds-md text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
              aria-label={t('detail.closePanel')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 详细信息 */}
        <div className="flex-1 space-y-ds-5 overflow-y-auto p-ds-4">
          <div>
            <SectionTitle>{t('detail.location')}</SectionTitle>
            <p className="break-all rounded-ds-md bg-surface px-ds-2 py-1.5 text-ds-sm text-content-secondary">
              {node.filePath}
              <span className="ml-1 text-content-muted">:{node.line}</span>
            </p>
          </div>

          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <div>
              <SectionTitle>{t('detail.details')}</SectionTitle>
              <pre className="overflow-x-auto rounded-ds-md bg-surface p-ds-2 text-ds-xs text-content-secondary">
                {JSON.stringify(node.metadata, null, 2)}
              </pre>
            </div>
          )}

          {inEdges.length > 0 && (
            <div>
              <SectionTitle>{t('detail.upstream')} ({inEdges.length})</SectionTitle>
              {renderEdgeList(inEdges, (e) => e.source)}
            </div>
          )}

          {outEdges.length > 0 && (
            <div>
              <SectionTitle>{t('detail.downstream')} ({outEdges.length})</SectionTitle>
              {renderEdgeList(outEdges, (e) => e.target)}
            </div>
          )}
        </div>

        {/* 底部:打开源码 */}
        <div className="shrink-0 border-t border-border-subtle p-ds-3">
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-ds-md bg-primary-600 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-primary-500"
            onClick={() => {
              const normalizedPath = node.filePath.replace(/\\/g, '/')
              const vscodeUrl = `vscode://file/${normalizedPath}:${node.line}`
              window.open(vscodeUrl, '_blank')
            }}
          >
            <span aria-hidden="true">↗</span>
            {t('detail.openVSCode')}
          </button>
        </div>
      </div>
    </>
  )
}
