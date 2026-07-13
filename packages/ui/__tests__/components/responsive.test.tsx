/**
 * feature-007 响应式布局测试:
 *  - Sidebar 桌面态(≥md)常驻、移动态(<md)为 off-canvas 抽屉,由 uiStore 控制。
 *  - TabPanel 移动态全屏覆盖 + 遮罩,桌面态 dock(md:static)。
 * 采用 SSR 静态标记断言 Tailwind 响应式前缀与 store 联动,不依赖 jsdom 视口。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { OmniGraph } from '@codeomnivis/shared'
import Sidebar from '../../src/components/Sidebar'
import { TabPanel } from '../../src/components/TabBar/TabPanel'
import { getUiState, __resetUiStore } from '../../src/store/uiStore'
import enUS from '../../src/locales/en-US.json'

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

describe('feature-007 responsive - Sidebar', () => {
  beforeEach(() => __resetUiStore())

  it('renders desktop persistent sidebar (md) and mobile drawer (md:hidden)', () => {
    const html = renderToStaticMarkup(
      <Sidebar graph={graph} selectedNode={null} onNodeSelect={() => {}} visibleNodeIds={undefined} />,
    )
    expect(html).toContain('hidden md:block')
    expect(html).toContain('md:hidden')
    expect(html).toContain('-translate-x-full')
    expect(html).toContain('role="dialog"')
  })

  it('mobile drawer open/close driven by uiStore.isMobileDrawerOpen', () => {
    getUiState().toggleMobileDrawer(true)
    const openHtml = renderToStaticMarkup(
      <Sidebar graph={graph} selectedNode={null} onNodeSelect={() => {}} visibleNodeIds={undefined} />,
    )
    expect(openHtml).toContain('translate-x-0')
    expect(openHtml).toContain('aria-hidden="false"')

    __resetUiStore()
    const closedHtml = renderToStaticMarkup(
      <Sidebar graph={graph} selectedNode={null} onNodeSelect={() => {}} visibleNodeIds={undefined} />,
    )
    expect(closedHtml).toContain('-translate-x-full')
    expect(closedHtml).toContain('aria-hidden="true"')
  })
})

describe('feature-007 responsive - TabPanel', () => {
  beforeEach(() => __resetUiStore())

  it('mobile full-screen overlay (fixed) falls back to dock (md:static) on desktop', () => {
    const html = renderWithQuery(<TabPanel activeTab="filter" onTabChange={() => {}} />)
    expect(html).toContain('fixed')
    expect(html).toContain('md:static')
    expect(html).toContain('md:w-96')
    expect(html).toContain(enUS['panel.close'])
  })
})
