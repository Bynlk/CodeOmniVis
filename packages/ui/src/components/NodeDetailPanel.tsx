import type { OmniNode, OmniEdge } from '@codeomnivis/shared'
import { NODE_COLORS } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'
import { buildVsCodeSourceHref } from '../lib/sourceLink'

interface NodeDetailPanelProps {
  node: OmniNode | null
  projectRoot?: string
  inEdges: OmniEdge[]
  outEdges: OmniEdge[]
  onClose: () => void
  onNodeSelect: (nodeId: string) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-ds-2 text-[11px] font-semibold text-content-secondary">
      {children}
    </h4>
  )
}

export default function NodeDetailPanel({
  node,
  projectRoot,
  inEdges,
  outEdges,
  onClose,
  onNodeSelect,
}: NodeDetailPanelProps) {
  const { t } = useTranslation()

  if (!node) return null

  const color = NODE_COLORS[node.type] || '#94a3b8'
  const sourceHref = buildVsCodeSourceHref(projectRoot, node.filePath, node.line)
  const renderEdgeList = (edges: OmniEdge[], pick: (e: OmniEdge) => string) => (
    <ul className="divide-y divide-border-subtle border-y border-border-subtle">
      {edges.map((edge) => (
        <li key={edge.id}>
          <button
            className="flex w-full items-center justify-between gap-ds-2 px-1 py-2 text-left text-[11px] text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
            onClick={() => onNodeSelect(pick(edge))}
          >
            <span className="truncate">{pick(edge).split(':').pop()}</span>
            <span className="shrink-0 rounded border border-border-subtle px-1.5 font-mono text-[10px] text-content-muted">
              {edge.type}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <div
        className="z-drawer flex h-full w-full flex-col overflow-hidden bg-surface-panel md:static md:z-auto md:h-full md:w-80 md:max-w-none md:shrink-0"
        role="complementary"
        aria-label={t('detail.inspectorLabel', 'Node inspector')}
      >
        {/* 头部 */}
        <div className="shrink-0 border-b border-border-subtle p-ds-4">
          <div className="flex items-start justify-between gap-ds-2">
            <div className="flex min-w-0 items-center gap-ds-2">
              <span className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-content">{node.name}</h3>
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
              ×
            </button>
          </div>
        </div>

        {/* 详细信息 */}
        <div className="flex-1 space-y-ds-5 overflow-y-auto p-ds-4">
          <div>
            <SectionTitle>{t('detail.location')}</SectionTitle>
            <p className="break-all rounded-md border border-border-subtle bg-surface px-ds-2 py-2 font-mono text-[11px] leading-5 text-content-secondary">
              {node.filePath}
              <span className="ml-1 text-content-muted">:{node.line}</span>
            </p>
          </div>

          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <div>
              <SectionTitle>{t('detail.details')}</SectionTitle>
              <pre className="overflow-x-auto rounded-md border border-border-subtle bg-surface p-ds-2 text-[11px] leading-5 text-content-secondary">
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
          {sourceHref ? (
            <a
              href={sourceHref}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary-600 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-500"
            >
              <span aria-hidden="true">↗</span>
              {t('detail.openVSCode')}
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-primary-600 py-2 text-xs font-medium text-white opacity-40"
            >
              <span aria-hidden="true">↗</span>
              {t('detail.openVSCode')}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
