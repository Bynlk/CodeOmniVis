/**
 * feature-003 Legend 测试:
 *  1. 存在性 —— 默认展开时渲染各节点类型条目。
 *  2. 单一真源 —— swatch 颜色必须等于 NODE_COLORS[type],与画布同源。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Legend } from '../../src/components/Legend'
import { NODE_COLORS, NODE_TYPE_LIST } from '../../src/lib/nodeConfig'
import { __resetUiStore, getUiState } from '../../src/store/uiStore'

describe('Legend', () => {
  beforeEach(() => {
    __resetUiStore()
  })

  it('默认展开,渲染标题与全部节点类型的 i18n key', () => {
    const html = renderToStaticMarkup(<Legend />)
    // useTranslation 无实例时 t 回显 key
    expect(html).toContain('legend.title')
    for (const type of NODE_TYPE_LIST) {
      expect(html).toContain(`nodeType.${type}`)
    }
  })

  it('swatch 颜色与 NODE_COLORS 单一真源一致', () => {
    const html = renderToStaticMarkup(<Legend />)
    for (const type of NODE_TYPE_LIST) {
      // 内联样式使用 background-color 承载单一真源色值
      expect(html.toLowerCase()).toContain(`background-color:${NODE_COLORS[type].toLowerCase()}`)
    }
  })

  it('折叠态下不渲染条目列表', () => {
    getUiState().toggleLegend(true)
    const html = renderToStaticMarkup(<Legend />)
    expect(html).toContain('legend.title')
    expect(html).not.toContain('nodeType.page')
  })
})
