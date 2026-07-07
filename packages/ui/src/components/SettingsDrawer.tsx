import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { postProject } from '../services'
import { useAiConfig } from '../hooks/useAiConfig'
import { AiConfigForm } from './AiConfigForm'
import { PROMOTION_TIERS, LICENSE_INFO } from '../lib/promotion'
import { STATUS_QUERY_KEY } from '../hooks/useStatus'

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
}

const TIER_ACCENT: Record<string, string> = {
  primary: 'border-l-4 border-primary-500 bg-primary-600/10',
  secondary: 'border-l-4 border-border-strong bg-surface-hover/30',
  tertiary: 'border-l-4 border-border-subtle bg-surface/40',
}

/** 设置抽屉(feature-011 重写):从右侧滑出,四组(AI / 项目 / 显示 / 关于)。 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const triggerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
    triggerRef.current?.focus?.()
    triggerRef.current = null
  }, [open, onClose])

  const { config } = useAiConfig()

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
      const result = await postProject(trimmed)
      if (result.ok) {
        setProjectMsg(result.projectRoot ?? trimmed)
        await queryClient.invalidateQueries({ queryKey: ['graph'] })
        await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
      } else {
        setProjectErr(result.errorMessage ?? t('settings.project.failed'))
      }
    } catch (err) {
      setProjectErr(err instanceof Error ? err.message : t('settings.project.failed'))
    } finally {
      setSwitching(false)
    }
  }, [projectRoot, switching, queryClient, t])

  const isZh = i18n.language === 'zh-CN'
  const setLang = useCallback((lang: 'zh-CN' | 'en-US') => {
    i18n.changeLanguage(lang)
    localStorage.setItem('codeomnivis-lang', lang)
  }, [i18n])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal flex justify-end" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      {/* 遮罩 */}
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label={t('settings.close')}
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <aside className="relative flex h-full w-96 max-w-full flex-col overflow-y-auto border-l border-border-subtle bg-surface-raised shadow-ds-panel">
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-raised px-ds-4 py-ds-3">
          <h2 className="flex items-center gap-1.5 text-ds-sm font-semibold text-content">
            <span aria-hidden="true">⚙</span> {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-ds-md text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('settings.close')}
          >
            ×
          </button>
        </div>

        {/* 组 1:AI */}
        <section className="space-y-ds-2 border-b border-border-subtle px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold uppercase tracking-wide text-content-muted">
            {t('settings.group.ai')}
          </h3>
          <AiConfigForm saveLabel={t('settings.ai.save')} showClear />
          <p className="text-ds-xs text-content-muted">
            {config ? `${t('settings.ai.current')}: ${config.model}` : t('ai.notConfigured')}
          </p>
        </section>

        {/* 组 2:项目 */}
        <section className="space-y-ds-2 border-b border-border-subtle px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold uppercase tracking-wide text-content-muted">
            {t('settings.group.project')}
          </h3>
          <input
            type="text"
            value={projectRoot}
            onChange={(e) => setProjectRoot(e.target.value)}
            placeholder={t('settings.project.placeholder')}
            className="w-full rounded-ds-md border border-border-subtle bg-surface px-ds-2 py-1.5 text-ds-xs text-content placeholder-content-muted focus:border-primary-500 focus:outline-none"
          />
          <button
            onClick={handleSwitchProject}
            disabled={!projectRoot.trim() || switching}
            className="w-full rounded-ds-md bg-primary-600 px-ds-2 py-1.5 text-ds-xs font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
          >
            {switching ? t('settings.project.switching') : t('settings.project.switch')}
          </button>
          {projectMsg && (
            <p className="break-all text-ds-xs text-emerald-400">
              {t('settings.project.switched')}: {projectMsg}
            </p>
          )}
          {projectErr && <p className="break-all text-ds-xs text-rose-400">{projectErr}</p>}
        </section>

        {/* 组 3:显示 */}
        <section className="space-y-ds-2 border-b border-border-subtle px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold uppercase tracking-wide text-content-muted">
            {t('settings.group.display')}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-ds-xs text-content-secondary">{t('settings.display.language')}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setLang('zh-CN')}
                className={`rounded-ds-md px-ds-2 py-1 text-ds-xs transition-colors ${isZh ? 'bg-primary-600 text-white' : 'bg-surface text-content-secondary hover:bg-surface-hover'}`}
              >
                中文
              </button>
              <button
                onClick={() => setLang('en-US')}
                className={`rounded-ds-md px-ds-2 py-1 text-ds-xs transition-colors ${!isZh ? 'bg-primary-600 text-white' : 'bg-surface text-content-secondary hover:bg-surface-hover'}`}
              >
                EN
              </button>
            </div>
          </div>
        </section>

        {/* 组 4:关于(三层推广位 + License) */}
        <section className="space-y-ds-3 px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold uppercase tracking-wide text-content-muted">
            {t('settings.group.about')}
          </h3>

          {PROMOTION_TIERS.map((slot) => (
            <a
              key={slot.tier}
              href={slot.url}
              target="_blank"
              rel="noreferrer"
              className={`block rounded-ds-md px-ds-3 py-ds-2 transition hover:brightness-110 ${TIER_ACCENT[slot.tier]}`}
            >
              <p className="text-ds-xs font-medium text-content">{t(slot.titleKey)}</p>
              <p className="mt-0.5 text-ds-xs text-content-secondary">{t(slot.descKey)}</p>
              <span className="mt-1 inline-block text-ds-xs text-primary-300">{t(slot.ctaKey)} →</span>
            </a>
          ))}

          <div className="border-t border-border-subtle pt-ds-2">
            <p className="text-ds-xs text-content-muted">{t(LICENSE_INFO.summaryKey)}</p>
            <a
              href={LICENSE_INFO.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-ds-xs text-primary-300 hover:underline"
            >
              {LICENSE_INFO.name}
            </a>
          </div>
        </section>
      </aside>
    </div>
  )
}
