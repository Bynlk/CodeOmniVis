import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { postProject } from '../services'
import { isAbsoluteProjectPath } from '../services/project'
import { LICENSE_INFO } from '../lib/promotion'
import { PROJECT_QUERY_KEY } from '../hooks/useProject'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { persistBrowserLanguage } from '../lib/languageStorage'
import { invalidateAnalysisQueries } from '../hooks/invalidateAnalysisQueries'

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
}

/** 工作台设置仅保留项目、显示和产品信息，AI 能力通过 MCP 暴露。 */
export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const focusTrapRef = useModalFocusTrap<HTMLElement>(open, onClose)

  const [projectRoot, setProjectRoot] = useState('')
  const [switching, setSwitching] = useState(false)
  const [projectMsg, setProjectMsg] = useState<string | null>(null)
  const [projectErr, setProjectErr] = useState<string | null>(null)

  const handleSwitchProject = useCallback(async () => {
    const trimmed = projectRoot.trim()
    if (trimmed === '' || switching || !isAbsoluteProjectPath(trimmed)) return
    setSwitching(true)
    setProjectMsg(null)
    setProjectErr(null)
    try {
      const result = await postProject(trimmed)
      if (result.ok) {
        setProjectMsg(result.projectRoot ?? trimmed)
        await invalidateAnalysisQueries(queryClient)
        await queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEY })
      } else {
        setProjectErr(result.errorMessage ?? t('settings.project.failed'))
      }
    } catch (err) {
      setProjectErr(err instanceof Error ? err.message : t('settings.project.failed'))
    } finally {
      setSwitching(false)
    }
  }, [projectRoot, switching, queryClient, t])

  const projectPathInvalid = projectRoot.trim() !== '' && !isAbsoluteProjectPath(projectRoot)
  const visibleProjectError = projectErr
    ?? (projectPathInvalid ? t('settings.project.absoluteRequired', 'Enter an absolute project path') : null)

  const isZh = i18n.language === 'zh-CN'
  const setLang = useCallback((lang: 'zh-CN' | 'en-US') => {
    i18n.changeLanguage(lang)
    persistBrowserLanguage(lang)
  }, [i18n])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal flex justify-end" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      {/* 遮罩 */}
      <div
        data-settings="backdrop"
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <aside
        ref={focusTrapRef}
        tabIndex={-1}
        data-modal-focus-trap="settings"
        className="relative flex h-full w-96 max-w-full flex-col overflow-y-auto border-l border-border-strong bg-surface-raised shadow-ds-panel"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-raised px-ds-4 py-ds-3">
          <div><h2 className="text-ds-sm font-semibold text-content">{t('settings.title')}</h2><p className="mt-0.5 text-[11px] text-content-muted">{t('settings.subtitle', 'Workspace preferences')}</p></div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-ds-md text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('settings.close')}
          >
            ×
          </button>
        </div>

        <section className="space-y-ds-2 border-b border-border-subtle px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold text-content-secondary">
            {t('settings.group.project')}
          </h3>
          <input
            type="text"
            value={projectRoot}
            onChange={(e) => setProjectRoot(e.target.value)}
            placeholder={t('settings.project.placeholder')}
            aria-invalid={projectPathInvalid}
            className="w-full rounded-ds-md border border-border-subtle bg-surface px-ds-2 py-1.5 text-ds-xs text-content placeholder-content-muted focus:border-primary-500 focus:outline-none"
          />
          <button
            onClick={handleSwitchProject}
            disabled={!projectRoot.trim() || projectPathInvalid || switching}
            className="w-full rounded-ds-md bg-primary-600 px-ds-2 py-1.5 text-ds-xs font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
          >
            {switching ? t('settings.project.switching') : t('settings.project.switch')}
          </button>
          {projectMsg && (
            <p className="break-all text-ds-xs text-emerald-400">
              {t('settings.project.switched')}: {projectMsg}
            </p>
          )}
          {visibleProjectError && <p className="break-all text-ds-xs text-rose-400">{visibleProjectError}</p>}
        </section>

        <section className="space-y-ds-2 border-b border-border-subtle px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold text-content-secondary">
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

        <section className="space-y-ds-3 px-ds-4 py-ds-4">
          <h3 className="text-ds-xs font-semibold text-content-secondary">
            {t('settings.group.about')}
          </h3>
          <div className="space-y-1 rounded-md border border-border-subtle bg-surface-panel p-3">
            <p className="text-ds-xs font-medium text-content">CodeOmniVis</p>
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
