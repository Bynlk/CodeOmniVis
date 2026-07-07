import { useMemo, useState } from 'react'
import type { OmniGraph, OmniNode, NodeType } from '@codeomnivis/shared'
import { NODE_COLORS } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI } from '../lib/nodeConfig'
import { useUiStore } from '../store/uiStore'

interface SidebarProps {
  graph?: OmniGraph
  selectedNode: string | null
  onNodeSelect: (nodeId: string | null) => void
  /** 搜索过滤后可见的节点 id 集合;未提供则显示全部。 */
  visibleNodeIds?: Set<string>
}

type NodesByType = Partial<Record<NodeType, OmniNode[]>>

/** 复用 NODE_COLORS 键集判定合法 NodeType(与 shared isNodeType 语义等价)。 */
function isNodeType(value: string): value is NodeType {
  return value in NODE_COLORS
}

export default function Sidebar({ graph, selectedNode, onNodeSelect, visibleNodeIds }: SidebarProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const isMobileDrawerOpen = useUiStore((s) => s.isMobileDrawerOpen)
  const toggleMobileDrawer = useUiStore((s) => s.toggleMobileDrawer)

  const visibleNodes = useMemo<OmniNode[]>(() => {
    const all = graph?.nodes ?? []
    if (!visibleNodeIds) return all
    return all.filter((n) => visibleNodeIds.has(n.id))
  }, [graph?.nodes, visibleNodeIds])

  const nodesByType = useMemo<NodesByType>(() => {
    return visibleNodes.reduce<NodesByType>((acc, node) => {
      const nodes = acc[node.type] ?? []
      nodes.push(node)
      acc[node.type] = nodes
      return acc
    }, {})
  }, [visibleNodes])

  const nodeTypes = useMemo(() => Object.keys(nodesByType).filter(isNodeType), [nodesByType])

  /** 分组节点列表(桌面展开态与移动抽屉共用)。 */
  function renderNodeList(onSelect: (id: string) => void) {
    if (nodeTypes.length === 0) {
      return (
        <div className="px-ds-3 py-ds-6 text-center text-ds-sm text-content-muted">
          {t('sidebar.noNodesFound')}
        </div>
      )
    }
    return (
      <div className="space-y-ds-5">
        {nodeTypes.map((type) => {
          const nodes = nodesByType[type] ?? []
          return (
            <div key={type}>
              <div className="mb-ds-2 flex items-center gap-ds-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[type] }}
                  aria-hidden="true"
                />
                <span aria-hidden="true" className="text-ds-sm">{NODE_EMOJI[type]}</span>
                <h3 className="text-ds-sm font-medium text-content-secondary">{t(`nodeType.${type}`)}</h3>
                <span className="ml-auto rounded-ds-sm bg-surface px-1.5 text-ds-xs text-content-muted">
                  {nodes.length}
                </span>
              </div>
              <ul className="space-y-0.5">
                {nodes.map((node) => {
                  const active = selectedNode === node.id
                  return (
                    <li key={node.id}>
                      <button
                        className={`flex w-full items-center gap-ds-2 rounded-ds-md px-ds-2 py-1.5 text-left text-ds-sm transition-colors ${
                          active
                            ? 'bg-primary-600 text-white'
                            : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                        }`}
                        onClick={() => onSelect(node.id)}
                        title={node.filePath}
                      >
                        <span className="truncate">{node.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    )
  }

  const listHeader = (
    <h2 className="text-ds-xs font-semibold uppercase tracking-wider text-content-muted">
      {t('sidebar.nodes')} ({visibleNodes.length})
    </h2>
  )

  return (
    <>
      {/* 桌面侧栏(≥md):可折叠/展开;移动端隐藏,改用下方抽屉。 */}
      {collapsed ? (
        <aside className="hidden w-11 shrink-0 flex-col items-center border-r border-border-subtle bg-surface-raised pt-ds-3 md:flex">
          <button
            onClick={() => setCollapsed(false)}
            className="flex h-7 w-7 items-center justify-center rounded-ds-md text-ds-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('sidebar.expand')}
            title={t('sidebar.expand')}
          >
            ▶
          </button>
          <div className="mt-ds-3 flex flex-col items-center gap-1.5">
            {nodeTypes.slice(0, 8).map((type) => {
              const nodes = nodesByType[type] ?? []
              return (
                <div
                  key={type}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[type] }}
                  title={`${t(`nodeType.${type}`)} (${nodes.length})`}
                />
              )
            })}
            {nodeTypes.length > 8 && (
              <span className="text-[10px] text-content-muted">+{nodeTypes.length - 8}</span>
            )}
          </div>
        </aside>
      ) : (
        <aside className="hidden md:block w-64 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface-raised">
          <div className="p-ds-4">
            <div className="mb-ds-4 flex items-center justify-between">
              {listHeader}
              <button
                onClick={() => setCollapsed(true)}
                className="flex h-7 w-7 items-center justify-center rounded-ds-md text-ds-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
                aria-label={t('sidebar.collapse')}
                title={t('sidebar.collapse')}
              >
                ◀
              </button>
            </div>
            {renderNodeList(onNodeSelect)}
          </div>
        </aside>
      )}

      {/* 移动端抽屉(<md):off-canvas,由 isMobileDrawerOpen 控制,画布不被挤压。 */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-drawer bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => toggleMobileDrawer(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-drawer w-72 max-w-[80vw] transform overflow-y-auto border-r border-border-subtle bg-surface-raised shadow-ds-panel transition-transform duration-200 md:hidden ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-label={t('sidebar.nodes')}
        aria-hidden={!isMobileDrawerOpen}
      >
        <div className="p-ds-4">
          <div className="mb-ds-4 flex items-center justify-between">
            {listHeader}
            <button
              onClick={() => toggleMobileDrawer(false)}
              className="flex h-8 w-8 items-center justify-center rounded-ds-md text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
              aria-label={t('drawer.close')}
              title={t('drawer.close')}
            >
              ✕
            </button>
          </div>
          {renderNodeList((id) => {
            onNodeSelect(id)
            toggleMobileDrawer(false)
          })}
        </div>
      </aside>
    </>
  )
}
