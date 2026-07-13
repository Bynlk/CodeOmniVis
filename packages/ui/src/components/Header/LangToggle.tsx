import { useTranslation } from 'react-i18next'
import { persistBrowserLanguage } from '../../lib/languageStorage'

/**
 * 语言切换(feature-011 重写)。图标按钮带 aria-label(a11y),图标 aria-hidden。
 */
export function LangToggle() {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh-CN'

  const toggle = () => {
    const next = isZh ? 'en-US' : 'zh-CN'
    i18n.changeLanguage(next)
    persistBrowserLanguage(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={isZh ? 'Switch to English' : '切换为中文'}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
    >
      <span aria-hidden="true">{isZh ? 'EN' : '中'}</span>
    </button>
  )
}
