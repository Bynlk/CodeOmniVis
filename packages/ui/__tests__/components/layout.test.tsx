/**
 * feature-004 布局重构测试:
 *  - TabBar 渲染 ≤4 个顶层分组。
 *  - TabPanel 为 dock(aside),不使用 absolute 覆盖画布,且提供关闭。
 *  - 分析组打开时渲染子导航(多子 tab)。
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TabBar } from '../../src/components/TabBar/TabBar'
import { TabPanel } from '../../src/components/TabBar/TabPanel'
import { TAB_GROUPS, findGroupOfTab } from '../../src/components/TabBar/tabGroups'
import enUS from '../../src/locales/en-US.json'

const translations: Record<string, unknown> = enUS

function translation(key: string): string {
  const value = translations[key]
  if (typeof value !== 'string') throw new Error(`Missing string translation: ${key}`)
  return value
}

function renderWithQuery(el: ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, el))
}

describe('TabBar 分组导航', () => {
  it('分组数量 ≤ 4', () => {
    expect(TAB_GROUPS.length).toBeLessThanOrEqual(4)
  })

  it('渲染每个分组的本地化标签', () => {
    const html = renderToStaticMarkup(
      <TabBar activeTab={null} onTabChange={() => {}} issueBadgeCount={0} />,
    )
    for (const g of TAB_GROUPS) {
      expect(html).toContain(translation(g.labelKey))
    }
  })

  it('issue badge 计数>0 时渲染', () => {
    const html = renderToStaticMarkup(
      <TabBar activeTab={null} onTabChange={() => {}} issueBadgeCount={7} />,
    )
    expect(html).toContain('7')
  })

  it('所有叶子 tab 都能映射回某个分组', () => {
    for (const g of TAB_GROUPS) {
      for (const c of g.children) {
        expect(findGroupOfTab(c.id)?.id).toBe(g.id)
      }
    }
  })
})

describe('TabPanel dock', () => {
  it('activeTab=null 时不渲染', () => {
    const html = renderToStaticMarkup(<TabPanel activeTab={null} onTabChange={() => {}} />)
    expect(html).toBe('')
  })

  it('打开时为 aside dock,不使用 absolute 覆盖,含关闭按钮', () => {
    const html = renderWithQuery(<TabPanel activeTab="filter" onTabChange={() => {}} />)
    expect(html).toContain('<aside')
    expect(html).not.toContain('absolute')
    expect(html).toContain(enUS['panel.close'])
  })

  it('分析组(多子 tab)渲染子导航', () => {
    const html = renderWithQuery(<TabPanel activeTab="filter" onTabChange={() => {}} />)
    expect(html).toContain(enUS['tab.dataflow'])
    expect(html).toContain(enUS['tab.trace'])
  })
})
