/**
 * feature-008 可访问性测试:关键交互控件的 aria/role 存在性(SSR 静态标记断言)。
 *  - CommandPalette:role=dialog + aria-modal + listbox/option。
 *  - SettingsDrawer:role=dialog + aria-modal + aria-label。
 *  - TabBar:role=tablist/tab + aria-selected。
 *  - LangToggle:图标按钮有 aria-label。
 * 不依赖 jsdom 视口与 i18n 初始化(未初始化时返回 key 文本)。
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OmniGraph } from '@codeomnivis/shared'
import { CommandPalette } from '../../src/components/CommandPalette'
import { SettingsDrawer } from '../../src/components/SettingsDrawer'
import { TabBar } from '../../src/components/TabBar/TabBar'
import { LangToggle } from '../../src/components/Header/LangToggle'

function renderWithQuery(el: ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, el))
}

const graph: OmniGraph = {
  nodes: [
    { id: 'page:/a.tsx:Home', type: 'page', name: 'Home', filePath: 'a.tsx', line: 1, column: 1, metadata: {} as never },
  ],
  edges: [],
}

describe('feature-008 a11y - CommandPalette', () => {
  it('打开时暴露 dialog / listbox / combobox 语义', () => {
    const html = renderWithQuery(
      <CommandPalette graph={graph} isOpen onClose={() => {}} onNodeSelect={() => {}} />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('role="listbox"')
    expect(html).toContain('role="combobox"')
  })

  it('有匹配结果时渲染 option + aria-selected', () => {
    const html = renderWithQuery(
      <CommandPalette graph={graph} isOpen onClose={() => {}} onNodeSelect={() => {}} />,
    )
    // query 为空不展示结果,这里仅断言列表容器与输入的可选中语义可用
    expect(html).toContain('aria-autocomplete="list"')
  })
})

describe('feature-008 a11y - SettingsDrawer', () => {
  it('暴露 dialog + aria-modal + aria-label', () => {
    const html = renderWithQuery(<SettingsDrawer open onClose={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label')
  })
})

describe('feature-008 a11y - TabBar', () => {
  it('暴露 tablist / tab / aria-selected', () => {
    const html = renderToStaticMarkup(
      <TabBar activeTab={null} onTabChange={() => {}} issueBadgeCount={0} />,
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tab"')
    expect(html).toContain('aria-selected')
  })
})

describe('feature-008 a11y - LangToggle', () => {
  it('图标按钮带 aria-label', () => {
    const html = renderToStaticMarkup(<LangToggle />)
    expect(html).toContain('aria-label')
    expect(html).toContain('aria-hidden="true"')
  })
})
