/**
 * 命令面板(feature-011 重写)。Cmd+K 打开,搜索节点并跳转。
 * 搜索词单一真源 = uiStore.searchQuery(与 Header 共享)。
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
  const query = useUiStore((s) => s.searchQuery)
  const setQuery = useUiStore((s) => s.setSearchQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // 记住打开前的焦点元素,关闭后归还焦点(a11y)。
  const triggerRef = useRef<HTMLElement | null>(null)

  const results = useMemo(() => {
    if (!graph || !query.trim()) return []
    return filterNodesByQuery(graph.nodes, query).slice(0, 20)
  }, [graph, query])

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
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
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-[18vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        className="relative w-full max-w-xl overflow-hidden rounded-ds-xl border border-border-strong bg-surface-raised shadow-ds-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.placeholder')}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-ds-3 border-b border-border-subtle px-ds-4 py-ds-3">
          <span className="text-content-muted" aria-hidden="true">🔍</span>
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
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 bg-transparent text-ds-base text-content placeholder-content-muted outline-none"
          />
          <kbd className="rounded-ds-sm border border-border-subtle bg-surface px-1.5 py-0.5 text-ds-xs text-content-muted">
            {t('commandPalette.esc')}
          </kbd>
        </div>

        {/* 结果列表 */}
        <div
          ref={listRef}
          id="cmd-results"
          role="listbox"
          aria-label={t('commandPalette.placeholder')}
          className="max-h-72 overflow-y-auto p-ds-1"
        >
          {results.length === 0 && query.trim() && (
            <div className="px-ds-4 py-ds-6 text-center text-ds-sm text-content-muted">
              {t('commandPalette.noResults')}
            </div>
          )}

          {results.map((node, idx) => (
            <button
              key={node.id}
              id={`cmd-option-${node.id}`}
              role="option"
              aria-selected={idx === selectedIndex}
              className={`flex w-full items-center gap-ds-3 rounded-ds-md px-ds-3 py-ds-2 text-left text-ds-sm transition-colors ${
                idx === selectedIndex
                  ? 'bg-primary-600/30 text-content'
                  : 'text-content-secondary hover:bg-surface-hover'
              }`}
              onClick={() => {
                onNodeSelect(node.id)
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="w-6 text-center" aria-hidden="true">{NODE_EMOJI[node.type] ?? '●'}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{node.name}</div>
                <div className="truncate text-ds-xs text-content-muted">{node.filePath}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 底部提示 */}
        {results.length > 0 && (
          <div className="flex items-center gap-ds-4 border-t border-border-subtle px-ds-4 py-ds-2 text-ds-xs text-content-muted">
            <span><kbd className="rounded-ds-sm bg-surface px-1 py-0.5">↑↓</kbd> {t('commandPalette.navigate')}</span>
            <span><kbd className="rounded-ds-sm bg-surface px-1 py-0.5">↵</kbd> {t('commandPalette.select')}</span>
            <span><kbd className="rounded-ds-sm bg-surface px-1 py-0.5">esc</kbd> {t('commandPalette.close')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
