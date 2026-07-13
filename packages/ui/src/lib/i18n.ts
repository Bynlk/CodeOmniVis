import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'
import { readBrowserLanguage } from './languageStorage'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: readBrowserLanguage(),
    fallbackLng: 'en-US',
    interpolation: { escapeValue: false },
  })

export default i18n
