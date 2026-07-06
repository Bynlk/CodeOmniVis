/**
 * 命令面板组件
 *
 * Cmd+K 打开，搜索节点并跳转。
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NODE_EMOJI } from '../lib/nodeConfig'
import { filterNodesByQuery } from '../lib/searchNodes'
import { useUiStore } from '../store/uiStore'
import type { OmniGraph } from '@codeomnivis/shared'

interface CommandPaletteProps {
  graph?: OmniGraph
  isOpen: boolean
  onClose: () => void
  onNodeSelect: (nodeId: string) => void
}

export function CommandPalette({ graph, isOpen, onClose, onNodeSelect }: CommandPaletteProps) {
  const { t } = useTranslation()
  // feature-005: search term single source = uiStore.searchQuery (shared with Header)
  const query = useUiStore((s) => s.searchQuery)
  const setQuery = useUiStore((s) => s.setSearchQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // feature-008 a11y: 记住打开前的焦点元素,关闭后归还焦点(AC1 焦点不丢失)。
  const triggerRef = useRef<HTMLElement | null>(null)

  // 搜索结果 —— 复用唯一索引函数 filterNodesByQuery(与 Header 过滤同源,AC1)。
  // 空 query 时 filterNodesByQuery 返回全部,这里仅在有输入时展示,避免刷屏。
  const results = useMemo(() => {
    if (!graph || !query.trim()) return []
    return filterNodesByQuery(graph.nodes, query).slice(0, 20) // 最多 20 条
  }, [graph, query])

  // 打开时聚焦输入框,并记住触发元素;关闭时把焦点还给触发元素。
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (triggerRef.current) {
      triggerRef.current.focus?.()
      triggerRef.current = null
    }
  }, [isOpen])

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          onNodeSelect(results[selectedIndex].id)
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [results, selectedIndex, onNodeSelect, onClose])

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children.item(selectedIndex)
      if (selected instanceof HTMLElement) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!isOpen) return null

  const activeOptionId = results[selectedIndex] ? `cmd-option-${results[selectedIndex].id}` : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* 面板 */}
      <div
        className="relative w-full max-w-lg bg-slate-800 rounded-lg shadow-2xl border border-slate-600 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.placeholder')}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <span className="text-slate-400" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="cmd-results"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label={t('commandPalette.placeholder')}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none text-sm"
          />
          <kbd className="px-1.5 py-0.5 text-xs text-slate-500 bg-slate-700 rounded">{t('commandPalette.esc')}</kbd>
        </div>

        {/* 结果列表 */}
        <div ref={listRef} id="cmd-results" role="listbox" aria-label={t('commandPalette.placeholder')} className="max-h-64 overflow-y-auto">
          {results.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              {t('commandPalette.noResults')}
            </div>
          )}

          {results.map((node, idx) => (
            <button
              key={node.id}
              id={`cmd-option-${node.id}`}
              role="option"
              aria-selected={idx === selectedIndex}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                idx === selectedIndex
                  ? 'bg-primary-600/30 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
              onClick={() => {
                onNodeSelect(node.id)
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="w-6 text-center" aria-hidden="true">{NODE_EMOJI[node.type] ?? '●'}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{node.name}</div>
                <div className="text-xs text-slate-500 truncate">{node.filePath}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 底部提示 */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500 flex items-center gap-4">
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">↑↓</kbd> {t('commandPalette.navigate')}</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">↵</kbd> {t('commandPalette.select')}</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">esc</kbd> {t('commandPalette.close')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
