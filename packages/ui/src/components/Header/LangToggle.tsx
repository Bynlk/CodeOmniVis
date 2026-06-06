import { useTranslation } from 'react-i18next'

export function LangToggle() {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh-CN'

  const toggle = () => {
    const next = isZh ? 'en-US' : 'zh-CN'
    i18n.changeLanguage(next)
    localStorage.setItem('omnivis-lang', next)
  }

  return (
    <button
      onClick={toggle}
      className="rounded px-2 py-1 text-xs text-slate-400
                 hover:bg-slate-700 hover:text-white transition-colors"
    >
      {isZh ? '🌐 EN' : '🌐 中'}
    </button>
  )
}
