import { useMemo, useState } from 'react'
import type { OmniGraph, OmniNode, NodeType } from '@codeomnivis/shared'
import { NODE_COLORS } from '@codeomnivis/shared'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../store/uiStore'

interface SidebarProps {
  graph?: OmniGraph
  selectedNode: string | null
  onNodeSelect: (nodeId: string | null) => void
  /** 搜索过滤后可见的节点 id 集合;未提供则显示全部(E-12/F16)。 */
  visibleNodeIds?: Set<string>
}

type NodesByType = Partial<Record<NodeType, OmniNode[]>>

/** DUP-03: 此处使用 value in NODE_COLORS 而非 shared 的 isNodeType()。
 *  NODE_COLORS 已导入用于节点着色，直接复用其键集避免了额外的 Set 构造开销。
 *  两者语义等价（NODE_COLORS 的键即为所有合法 NodeType）。 */
function isNodeType(value: string): value is NodeType {
  return value in NODE_COLORS
}

export default function Sidebar({ graph, selectedNode, onNodeSelect, visibleNodeIds }: SidebarProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  // feature-007:移动端抽屉开合由 store 统一控制(与 Header 菜单按钮联动)。
  const isMobileDrawerOpen = useUiStore((s) => s.isMobileDrawerOpen)
  const toggleMobileDrawer = useUiStore((s) => s.toggleMobileDrawer)

  // 搜索过滤:仅保留 visibleNodeIds 中的节点(未提供则全部)
  const visibleNodes = useMemo<OmniNode[]>(() => {
    const all = graph?.nodes ?? []
    if (!visibleNodeIds) return all
    return all.filter((n) => visibleNodeIds.has(n.id))
  }, [graph?.nodes, visibleNodeIds])

  // 按类型分组节点
  const nodesByType = useMemo<NodesByType>(() => {
    return visibleNodes.reduce<NodesByType>((acc, node) => {
      const nodes = acc[node.type] ?? []
      nodes.push(node)
      acc[node.type] = nodes
      return acc
    }, {})
  }, [visibleNodes])

  const nodeTypes = useMemo(() => Object.keys(nodesByType).filter(isNodeType), [nodesByType])

  /** 分组节点列表(桌面展开态与移动抽屉共用,避免重复标记)。 */
  function renderNodeList(onSelect: (id: string) => void) {
    if (nodeTypes.length === 0) {
      return <p className="text-slate-500 text-sm">{t('sidebar.noNodesFound')}</p>
    }
    return (
      <div className="space-y-4">
        {nodeTypes.map((type) => {
          const nodes = nodesByType[type] ?? []
          return (
            <div key={type}>
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[type] }} />
                <h3 className="text-sm font-medium text-slate-300">{t(`nodeType.${type}`)}</h3>
                <span className="text-xs text-slate-500">({nodes.length})</span>
              </div>
              <ul className="space-y-1 ml-5">
                {nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                        selectedNode === node.id
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                      }`}
                      onClick={() => onSelect(node.id)}
                      title={node.filePath}
                    >
                      {node.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* 桌面侧栏(≥md):保留折叠/展开;移动端隐藏,改用下方抽屉。 */}
      {collapsed ? (
        <aside className="hidden md:flex w-10 bg-slate-800 border-r border-slate-700 flex-col items-center pt-3 shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
            aria-label={t('sidebar.expand')}
            title={t('sidebar.expand')}
          >
            ▶
          </button>
          <div className="mt-3 flex flex-col items-center gap-1">
            {nodeTypes.slice(0, 8).map((type) => {
              const nodes = nodesByType[type] ?? []
              return (
                <div
                  key={type}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[type] }}
                  title={`${t(`nodeType.${type}`)} (${nodes.length})`}
                />
              )
            })}
            {nodeTypes.length > 8 && (
              <span className="text-[10px] text-slate-500">+{nodeTypes.length - 8}</span>
            )}
          </div>
        </aside>
      ) : (
        <aside className="hidden md:block w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto shrink-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                {t('sidebar.nodes')} ({visibleNodes.length})
              </h2>
              <button
                onClick={() => setCollapsed(true)}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
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
          className="fixed inset-0 z-drawer bg-black/50 md:hidden"
          onClick={() => toggleMobileDrawer(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-drawer w-72 max-w-[80vw] bg-slate-800 border-r border-slate-700
                    overflow-y-auto shadow-xl transform transition-transform duration-200 md:hidden ${
                      isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
        role="dialog"
        aria-label={t('sidebar.nodes')}
        aria-hidden={!isMobileDrawerOpen}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {t('sidebar.nodes')} ({visibleNodes.length})
            </h2>
            <button
              onClick={() => toggleMobileDrawer(false)}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
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
