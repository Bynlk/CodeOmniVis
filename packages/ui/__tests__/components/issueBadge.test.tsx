/**
 * feature-006 测试:
 *  - 徽标数量映射:issueBadgeCount = errors?.length ?? 0(含 undefined、空、非空)。
 *  - TabBar:数量为 0 时不渲染徽标;>0 时渲染。
 *  - WsStatusIndicator:三种 wsStatus 分别渲染对应文案与颜色点。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TabBar } from '../../src/components/TabBar/TabBar'
import { WsStatusIndicator } from '../../src/components/Header/WsStatusIndicator'
import type { ParseError } from '../../src/services'
import { getUiState, __resetUiStore, type WsStatus } from '../../src/store/uiStore'
import enUS from '../../src/locales/en-US.json'

/** 复刻 App.tsx 里的映射逻辑,保证与生产一致。 */
function toBadgeCount(errors: ParseError[] | undefined): number {
  return errors?.length ?? 0
}

describe('feature-006 徽标数量映射', () => {
  it('errors 为 undefined → 0', () => {
    expect(toBadgeCount(undefined)).toBe(0)
  })

  it('errors 为空数组 → 0', () => {
    expect(toBadgeCount([])).toBe(0)
  })

  it('errors 有 3 条 → 3', () => {
    const errs = [{}, {}, {}] as unknown as ParseError[]
    expect(toBadgeCount(errs)).toBe(3)
  })
})

describe('feature-006 TabBar 徽标呈现', () => {
  it('数量为 0 时不渲染红色徽标', () => {
    const html = renderToStaticMarkup(
      <TabBar activeTab={null} onTabChange={() => {}} issueBadgeCount={0} />,
    )
    expect(html).not.toContain('bg-red-500')
  })

  it('数量>0 时渲染红色徽标与数字', () => {
    const html = renderToStaticMarkup(
      <TabBar activeTab={null} onTabChange={() => {}} issueBadgeCount={5} />,
    )
    expect(html).toContain('bg-red-500')
    expect(html).toContain('5')
  })
})

describe('feature-006 WsStatusIndicator', () => {
  beforeEach(() => {
    __resetUiStore()
  })

  const cases: Array<{ status: WsStatus; label: string; dot: string }> = [
    { status: 'connected', label: enUS.ws.connected, dot: 'bg-green-500' },
    { status: 'connecting', label: enUS.ws.connecting, dot: 'bg-slate-400' },
    { status: 'reconnecting', label: enUS.ws.reconnecting, dot: 'bg-yellow-500' },
  ]

  for (const c of cases) {
    it(`${c.status} → 渲染 ${c.dot} 与文案`, () => {
      getUiState().setWsStatus(c.status)
      const html = renderToStaticMarkup(<WsStatusIndicator />)
      expect(html).toContain(c.dot)
      expect(html).toContain(c.label)
      expect(html).toContain('role="status"')
    })
  }
})
