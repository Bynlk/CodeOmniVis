import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { isAiConfig, isJsonObject, type AiConfig } from '@codeomnivis/shared'
import { loadAiConfig, saveAiConfig, clearAiConfig } from '../lib/aiConfig'
import { PROMOTION_TIERS, LICENSE_INFO } from '../lib/promotion'
import { STATUS_QUERY_KEY } from '../hooks/useStatus'

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
}

const TIER_ACCENT: Record<string, string> = {
  primary: 'border-l-4 border-primary-500 bg-primary-600/10',
  secondary: 'border-l-4 border-slate-500 bg-slate-700/30',
  tertiary: 'border-l-4 border-slate-600 bg-slate-800/40',
}

function readString(obj: unknown, key: string): string | undefined {
  if (isJsonObject(obj) && typeof obj[key] === 'string') return obj[key]
  return undefined
}

/** 设置抽屉:从右侧滑出,四组(AI / 项目 / 显示 / 关于)。 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()

  // --- AI 组 ---
  const [config, setConfig] = useState<AiConfig | null>(() => loadAiConfig())
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl)
      setApiKey(config.apiKey)
      setModel(config.model)
    }
  }, [config])

  const handleSaveAi = useCallback(() => {
    const next: AiConfig = { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() }
    if (!isAiConfig(next)) return
    saveAiConfig(next)
    setConfig(next)
  }, [baseUrl, apiKey, model])

  const handleClearAi = useCallback(() => {
    clearAiConfig()
    setConfig(null)
    setBaseUrl('')
    setApiKey('')
    setModel('')
  }, [])

  // --- 项目组 ---
  const [projectRoot, setProjectRoot] = useState('')
  const [switching, setSwitching] = useState(false)
  const [projectMsg, setProjectMsg] = useState<string | null>(null)
  const [projectErr, setProjectErr] = useState<string | null>(null)

  const handleSwitchProject = useCallback(async () => {
    const trimmed = projectRoot.trim()
    if (trimmed === '' || switching) return
    setSwitching(true)
    setProjectMsg(null)
    setProjectErr(null)
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot: trimmed }),
      })
      const payload: unknown = await res.json()
      if (res.ok) {
        const data = isJsonObject(payload) ? payload.data : undefined
        const resolved = readString(data, 'projectRoot') ?? trimmed
        setProjectMsg(resolved)
        await queryClient.invalidateQueries({ queryKey: ['graph'] })
        await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
      } else {
        const err = isJsonObject(payload) ? payload.error : undefined
        setProjectErr(readString(err, 'message') ?? t('settings.project.failed'))
      }
    } catch (err) {
      setProjectErr(err instanceof Error ? err.message : t('settings.project.failed'))
    } finally {
      setSwitching(false)
    }
  }, [projectRoot, switching, queryClient, t])

  // --- 显示组 ---
  const isZh = i18n.language === 'zh-CN'
  const setLang = useCallback((lang: 'zh-CN' | 'en-US') => {
    i18n.changeLanguage(lang)
    localStorage.setItem('codeomnivis-lang', lang)
  }, [i18n])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* 遮罩 */}
      <button
        className="absolute inset-0 bg-black/50"
        aria-label={t('settings.close')}
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <aside className="relative w-96 max-w-full h-full bg-slate-800 border-l border-slate-700 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">⚙ {t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg leading-none"
            aria-label={t('settings.close')}
          >
            ×
          </button>
        </div>

        {/* 组 1:AI */}
        <section className="px-4 py-4 border-b border-slate-700 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.group.ai')}
          </h3>
          <input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="Base URL (e.g. https://api.openai.com/v1)"
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="API Key"
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="Model (e.g. gpt-4o-mini)"
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveAi}
              disabled={!baseUrl.trim() || !apiKey.trim() || !model.trim()}
              className="flex-1 px-2 py-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-xs"
            >
              {t('settings.ai.save')}
            </button>
            <button
              onClick={handleClearAi}
              disabled={config === null}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded text-xs"
            >
              {t('settings.ai.clear')}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {config ? `${t('settings.ai.current')}: ${config.model}` : t('ai.notConfigured')}
          </p>
        </section>

        {/* 组 2:项目 */}
        <section className="px-4 py-4 border-b border-slate-700 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.group.project')}
          </h3>
          <input
            type="text"
            value={projectRoot}
            onChange={e => setProjectRoot(e.target.value)}
            placeholder={t('settings.project.placeholder')}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <button
            onClick={handleSwitchProject}
            disabled={!projectRoot.trim() || switching}
            className="w-full px-2 py-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-xs"
          >
            {switching ? t('settings.project.switching') : t('settings.project.switch')}
          </button>
          {projectMsg && (
            <p className="text-[11px] text-emerald-400 break-all">
              {t('settings.project.switched')}: {projectMsg}
            </p>
          )}
          {projectErr && (
            <p className="text-[11px] text-red-400 break-all">{projectErr}</p>
          )}
        </section>

        {/* 组 3:显示 */}
        <section className="px-4 py-4 border-b border-slate-700 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.group.display')}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">{t('settings.display.language')}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setLang('zh-CN')}
                className={`px-2 py-1 rounded text-xs ${isZh ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                中文
              </button>
              <button
                onClick={() => setLang('en-US')}
                className={`px-2 py-1 rounded text-xs ${!isZh ? 'bg-primary-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                EN
              </button>
            </div>
          </div>
        </section>

        {/* 组 4:关于(三层推广位 + License) */}
        <section className="px-4 py-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.group.about')}
          </h3>

          {PROMOTION_TIERS.map(slot => (
            <a
              key={slot.tier}
              href={slot.url}
              target="_blank"
              rel="noreferrer"
              className={`block px-3 py-2 rounded ${TIER_ACCENT[slot.tier]} hover:brightness-110 transition`}
            >
              <p className="text-xs font-medium text-white">{t(slot.titleKey)}</p>
              <p className="text-[11px] text-slate-300 mt-0.5">{t(slot.descKey)}</p>
              <span className="text-[11px] text-primary-300 mt-1 inline-block">{t(slot.ctaKey)} →</span>
            </a>
          ))}

          <div className="pt-2 border-t border-slate-700">
            <p className="text-[11px] text-slate-400">{t(LICENSE_INFO.summaryKey)}</p>
            <a
              href={LICENSE_INFO.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary-300 hover:underline break-all"
            >
              {LICENSE_INFO.name}
            </a>
          </div>
        </section>
      </aside>
    </div>
  )
}
