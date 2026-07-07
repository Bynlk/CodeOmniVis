import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isAiConfig, validateUpstreamBaseUrl, type AiConfig } from '@codeomnivis/shared'
import { setAiConfig, clearAiConfig } from '../lib/aiConfig'
import { useAiConfig } from '../hooks/useAiConfig'

/** prepareAiSave 的决策结果（判别联合，便于纯单测）。 */
export type AiSaveDecision =
  | { ok: true; config: AiConfig; rememberKey: boolean }
  | { ok: false; reason: string | null }

/** 表单原始草稿（未裁剪）。 */
export interface AiDraft {
  baseUrl: string
  apiKey: string
  model: string
}

/**
 * 纯决策：裁剪草稿 → 校验完整性 → SSRF/https 校验。
 *  - 字段缺失：ok=false 且 reason=null（静默，UI 不展示错误，仅禁用保存）。
 *  - URL 非法：ok=false 且 reason 为具体原因。
 *  - 合法：ok=true，返回裁剪后的 config 与 rememberKey。
 */
export function prepareAiSave(draft: AiDraft, rememberKey: boolean): AiSaveDecision {
  const candidate = {
    baseUrl: draft.baseUrl.trim(),
    apiKey: draft.apiKey.trim(),
    model: draft.model.trim(),
  }
  if (!isAiConfig(candidate)) return { ok: false, reason: null }
  const check = validateUpstreamBaseUrl(candidate.baseUrl)
  if (!check.ok) return { ok: false, reason: check.reason ?? null }
  return { ok: true, config: candidate, rememberKey }
}

interface AiConfigFormProps {
  /** 保存按钮文案（两处入口用不同 i18n key）。 */
  saveLabel: string
  /** 是否显示“清除”按钮（SettingsDrawer 显示，AiPanel 不显示）。 */
  showClear?: boolean
  /** 保存成功后的回调（如关闭面板）。 */
  onSaved?: () => void
}

const INPUT_CLASS =
  'w-full rounded-ds-md border border-border-subtle bg-surface px-ds-3 py-1.5 text-ds-xs text-content placeholder:text-content-muted transition-colors focus:border-primary-500 focus:outline-none'

/**
 * AI 配置受控表单。单一数据源为全局 store（useAiConfig + setAiConfig），
 * AiPanel 与 SettingsDrawer 共用此组件。
 */
export function AiConfigForm({ saveLabel, showClear = false, onSaved }: AiConfigFormProps) {
  const { t } = useTranslation()
  const { config, rememberKey: storedRemember } = useAiConfig()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [rememberKey, setRememberKey] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl)
      setApiKey(config.apiKey)
      setModel(config.model)
    }
    setRememberKey(storedRemember)
  }, [config, storedRemember])

  const handleSave = useCallback(() => {
    const decision = prepareAiSave({ baseUrl, apiKey, model }, rememberKey)
    if (!decision.ok) {
      if (decision.reason !== null) setError(decision.reason)
      return
    }
    setError(null)
    setAiConfig(decision.config, decision.rememberKey)
    if (onSaved) onSaved()
  }, [baseUrl, apiKey, model, rememberKey, onSaved])

  const handleClear = useCallback(() => {
    clearAiConfig()
    setBaseUrl('')
    setApiKey('')
    setModel('')
    setRememberKey(false)
    setError(null)
  }, [])

  return (
    <div className="space-y-ds-2">
      <input
        type="text"
        value={baseUrl}
        onChange={e => setBaseUrl(e.target.value)}
        placeholder="Base URL (e.g. https://api.openai.com/v1)"
        className={INPUT_CLASS}
      />
      <input
        type="password"
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        placeholder="API Key"
        className={INPUT_CLASS}
      />
      <input
        type="text"
        value={model}
        onChange={e => setModel(e.target.value)}
        placeholder="Model (e.g. gpt-4o-mini)"
        className={INPUT_CLASS}
      />
      <label className="flex cursor-pointer select-none items-center gap-2 text-[11px] text-content-secondary">
        <input
          type="checkbox"
          checked={rememberKey}
          onChange={e => setRememberKey(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border-strong bg-surface text-primary-600 focus:ring-primary-500"
        />
        {t('settings.ai.rememberKey')}
      </label>
      {error && (
        <p className="break-all text-[11px] text-rose-400">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!baseUrl.trim() || !apiKey.trim() || !model.trim()}
          className="flex-1 rounded-ds-md bg-primary-600 px-ds-3 py-1.5 text-ds-xs font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {saveLabel}
        </button>
        {showClear && (
          <button
            onClick={handleClear}
            disabled={config === null}
            className="rounded-ds-md border border-border-subtle bg-surface-hover px-ds-3 py-1.5 text-ds-xs text-content-secondary transition-colors hover:bg-surface-overlay disabled:opacity-50"
          >
            {t('settings.ai.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
