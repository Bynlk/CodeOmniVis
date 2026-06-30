/**
 * H11 / DUP-03:AiConfigForm 公共受控组件测试。
 *
 * 无 DOM 事件环境(node + react-dom/server),因此分两层验证:
 *  1. 渲染层:静态渲染断言含 baseUrl/apiKey/model 输入、记住密钥、保存按钮(以及可选清除按钮)。
 *  2. 决策层:纯函数 prepareAiSave —— 合法配置触发保存路径;非法 URL 返回错误原因。
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiConfigForm, prepareAiSave } from '../../src/components/AiConfigForm'

describe('AiConfigForm 渲染', () => {
  it('渲染 baseUrl / apiKey / model 输入、记住密钥与保存按钮', () => {
    const html = renderToStaticMarkup(<AiConfigForm saveLabel="SAVE_LABEL_X" />)
    expect(html).toContain('Base URL')
    expect(html).toContain('API Key')
    expect(html).toContain('Model')
    // useTranslation 无实例时 t 回显 key,可据此断言记住密钥文案存在。
    expect(html).toContain('settings.ai.rememberKey')
    expect(html).toContain('SAVE_LABEL_X')
  })

  it('showClear 时渲染清除按钮', () => {
    const html = renderToStaticMarkup(<AiConfigForm saveLabel="SAVE" showClear />)
    expect(html).toContain('settings.ai.clear')
  })

  it('默认不渲染清除按钮', () => {
    const html = renderToStaticMarkup(<AiConfigForm saveLabel="SAVE" />)
    expect(html).not.toContain('settings.ai.clear')
  })
})

describe('prepareAiSave 决策', () => {
  it('合法配置返回 ok 并裁剪空白', () => {
    const result = prepareAiSave(
      { baseUrl: '  https://api.openai.com/v1  ', apiKey: ' sk-xxx ', model: ' gpt-4o-mini ' },
      true,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config).toEqual({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-xxx', model: 'gpt-4o-mini' })
      expect(result.rememberKey).toBe(true)
    }
  })

  it('非法 URL(私网)返回错误原因', () => {
    const result = prepareAiSave(
      { baseUrl: 'http://10.0.0.1/v1', apiKey: 'sk-xxx', model: 'gpt-4o-mini' },
      false,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).not.toBeNull()
      expect(result.reason).toMatch(/private|metadata|link-local/i)
    }
  })

  it('非 https 的非环回地址返回错误原因', () => {
    const result = prepareAiSave(
      { baseUrl: 'http://example.com/v1', apiKey: 'sk-xxx', model: 'gpt-4o-mini' },
      false,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).not.toBeNull()
  })

  it('字段缺失返回 ok=false 且 reason 为 null(静默,不显示错误)', () => {
    const result = prepareAiSave({ baseUrl: '', apiKey: '', model: '' }, false)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBeNull()
  })
})
