/**
 * feature-006 测试:
 *  - WsStatusIndicator:三种 wsStatus 分别渲染对应文案与颜色点。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WsStatusIndicator } from '../../src/components/Header/WsStatusIndicator'
import { getUiState, __resetUiStore, type WsStatus } from '../../src/store/uiStore'
import enUS from '../../src/locales/en-US.json'

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
